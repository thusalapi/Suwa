import type { ReactNode } from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { semanticLight as c } from "@/lib/design/tokens.semantic";
import { brand } from "@/lib/branding/brand";
import { getT, formatDate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { PAGE_CONTENT, type Template, type Section, type ResultRow } from "@/lib/report-engine/template";
import type { ReportData, ResultValue } from "@/lib/report-engine/report-data";
import { isAbnormal, isCritical, type Flag } from "@/lib/report-engine/flag";

/**
 * Branded PDF for a report — server-side via @react-pdf/renderer (pure Node, no headless
 * browser). Reads ONLY the frozen snapshot + stored data + the clinic identity, so an issued
 * report re-renders identically forever. Colours come from the design-token layer.
 */
export interface ReportClinic {
  name: string;
  address: string | null;
  phone: string | null;
  /** Optional — only the report header shows these; bill/revenue PDFs omit them. */
  fax?: string | null;
  email?: string | null;
  logoUrl: string | null;
}

export interface ReportDocumentProps {
  locale: Locale;
  clinic: ReportClinic;
  /** Optional QR (PNG data URL) encoding the report number, shown in the header. */
  qrDataUrl?: string | null;
  report: {
    reportNumber: number;
    status: "draft" | "finalized" | "verified";
    patientName: string;
    snapshot: Template;
    data: ReportData;
    verifiedByName: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
  };
}

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, color: c.ink },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  clinicName: { fontSize: 16, fontWeight: 700, color: c.primaryDark },
  clinicMeta: { fontSize: 9, color: c.muted, marginTop: 2 },
  contact: { fontSize: 9, color: c.muted, textAlign: "right" },
  confidential: { fontSize: 9, fontWeight: 700, color: c.ink, marginTop: 2, textAlign: "right" },
  logo: { width: 96, height: 40, objectFit: "contain" },
  headerRight: { alignItems: "flex-end" },
  qr: { width: 50, height: 50, marginTop: 4 },
  qrCaption: { fontSize: 7, color: c.muted, marginTop: 1 },
  rule: { borderBottomWidth: 1, borderBottomColor: c.border, marginVertical: 8 },
  draft: {
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#FEECEC",
    color: c.danger,
    fontWeight: 700,
    fontSize: 10,
  },
  titleRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  reportTitle: { fontSize: 13, fontWeight: 700 },
  meta: { fontSize: 9, color: c.muted },
  piGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  piItem: { width: "25%", marginBottom: 4 },
  piLabel: { fontSize: 7, color: c.muted, textTransform: "uppercase" },
  piValue: { fontSize: 10 },
  // Inline "Label : Value" rows in two columns (the lab house style).
  piRow: { width: "50%", flexDirection: "row", marginBottom: 4, paddingRight: 12 },
  piRowLabel: { width: 102, fontSize: 9, color: c.muted },
  piRowValue: { flex: 1, fontSize: 10, fontWeight: 700, color: c.ink },
  // Compact Test — Result list.
  listTitle: { fontSize: 11, fontWeight: 700, color: c.primaryDark, marginTop: 10, marginBottom: 4 },
  listHeadRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 3, marginBottom: 2 },
  listHeadCell: { fontSize: 8, color: c.muted, textTransform: "uppercase", fontWeight: 700 },
  listRow: { flexDirection: "row", paddingVertical: 3 },
  listTest: { width: "50%", fontSize: 10 },
  listResult: { width: "50%", fontSize: 10, fontWeight: 700 },
  sigSubtitle: { fontSize: 8, color: c.muted, marginTop: 1 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  tHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 3 },
  tRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.border, paddingVertical: 3 },
  th: { fontSize: 8, color: c.muted, textTransform: "uppercase" },
  td: { fontSize: 10 },
  cTest: { width: "38%" },
  cResult: { width: "16%" },
  cUnit: { width: "14%" },
  cRange: { width: "20%" },
  cFlag: { width: "12%" },
  abnormal: { fontWeight: 700, color: c.danger },
  fieldLabel: { fontSize: 7, color: c.muted, textTransform: "uppercase", marginTop: 8 },
  fieldValue: { fontSize: 10, marginTop: 1 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 6,
    fontSize: 8,
    color: c.muted,
  },
});

function rangeLabel(row: ResultRow): string {
  if (row.ref_low != null && row.ref_high != null) return `${row.ref_low}-${row.ref_high}`;
  if (row.ref_low != null) return `>= ${row.ref_low}`;
  if (row.ref_high != null) return `<= ${row.ref_high}`;
  return "-";
}

export function ReportDocument({ locale, clinic, qrDataUrl, report }: ReportDocumentProps) {
  const t = getT(locale);
  const { snapshot, data } = report;
  const results = (data.results ?? {}) as Record<string, ResultValue>;
  const patientInfo = (data.patient_info ?? {}) as Record<string, string | number>;
  const showLogo = !!clinic.logoUrl && (clinic.logoUrl.startsWith("http") || clinic.logoUrl.startsWith("data:"));

  const isCanvas = snapshot.layout === "canvas";

  /** The inner content for one block — shared by flow (fragment-wrapped) and canvas (absolute). */
  const renderInner = (section: Section): ReactNode => {
    switch (section.type) {
      case "static":
        return <Text style={section.heading ? styles.sectionTitle : styles.meta}>{section.text}</Text>;

      case "patient_info":
        return (
          <View style={styles.piGrid}>
            {section.fields.map((f) => (
              <View key={f} style={styles.piRow}>
                <Text style={styles.piRowLabel}>{t(`reports.pi_${f}`)}</Text>
                <Text style={styles.piRowValue}>{patientInfo[f] != null ? String(patientInfo[f]) : "-"}</Text>
              </View>
            ))}
          </View>
        );

      case "results_table":
        if (section.style === "list") {
          return (
            <View wrap={false}>
              {section.title ? <Text style={styles.listTitle}>{section.title}</Text> : null}
              {section.listHeader ? (
                <View style={styles.listHeadRow}>
                  <Text style={[styles.listHeadCell, { width: "50%" }]}>{section.listHeader.left}</Text>
                  <Text style={[styles.listHeadCell, { width: "50%" }]}>{section.listHeader.right}</Text>
                </View>
              ) : null}
              {section.rows.map((row) => {
                const entry = results[row.key];
                const result =
                  entry != null
                    ? `${entry.value}${row.unit ? ` ${row.unit}` : ""}` +
                      (entry.value2 != null && row.unit2 ? `    ${entry.value2} ${row.unit2}` : "")
                    : "-";
                return (
                  <View key={row.key} style={styles.listRow}>
                    <Text style={styles.listTest}>{row.test}</Text>
                    <Text style={styles.listResult}>{result}</Text>
                  </View>
                );
              })}
            </View>
          );
        }
        return (
          <View wrap={false}>
            {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
            <View style={styles.tHead}>
              <Text style={[styles.th, styles.cTest]}>{t("reports.test")}</Text>
              <Text style={[styles.th, styles.cResult]}>{t("reports.result")}</Text>
              <Text style={[styles.th, styles.cUnit]}>{t("reports.unit")}</Text>
              <Text style={[styles.th, styles.cRange]}>{t("reports.refRange")}</Text>
              <Text style={[styles.th, styles.cFlag]}>{t("reports.flag")}</Text>
            </View>
            {section.rows.map((row) => {
              const entry = results[row.key];
              const flag = entry?.flag as Flag | undefined;
              const abn = !!flag && isAbnormal(flag);
              const cell = abn ? [styles.td, styles.abnormal] : [styles.td];
              return (
                <View
                  key={row.key}
                  style={flag && isCritical(flag) ? [styles.tRow, { backgroundColor: "#FEECEC" }] : styles.tRow}
                >
                  <Text style={[styles.td, styles.cTest]}>{row.test}</Text>
                  <Text style={[...cell, styles.cResult]}>{entry ? String(entry.value) : "-"}</Text>
                  <Text style={[styles.td, styles.cUnit]}>{row.unit || "-"}</Text>
                  <Text style={[styles.td, styles.cRange]}>{rangeLabel(row)}</Text>
                  <Text style={[...cell, styles.cFlag]}>{flag ? t(`reports.flag_${flag}`) : "-"}</Text>
                </View>
              );
            })}
          </View>
        );

      case "field":
      case "textarea": {
        const value = data[section.key];
        return (
          <View>
            <Text style={styles.fieldLabel}>{section.label}</Text>
            <Text style={styles.fieldValue}>{value != null && value !== "" ? String(value) : "-"}</Text>
          </View>
        );
      }

      case "signature":
        return (
          <View style={isCanvas ? undefined : { marginTop: 16 }}>
            <Text style={styles.meta}>
              {section.label}:{" "}
              {report.status === "verified" && report.verifiedByName
                ? report.verifiedByName
                : t("reports.pendingVerification")}
            </Text>
            {section.subtitle ? <Text style={styles.sigSubtitle}>{section.subtitle}</Text> : null}
          </View>
        );

      default:
        return null;
    }
  };

  const clinicHeader = (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.clinicName}>{clinic.name}</Text>
          {clinic.address ? <Text style={styles.clinicMeta}>{clinic.address}</Text> : null}
        </View>
        <View style={styles.headerRight}>
          {clinic.phone ? (
            <Text style={styles.contact}>
              {t("reports.tel")}: {clinic.phone}
            </Text>
          ) : null}
          {clinic.fax ? (
            <Text style={styles.contact}>
              {t("reports.fax")}: {clinic.fax}
            </Text>
          ) : null}
          {clinic.email ? (
            <Text style={styles.contact}>
              {t("reports.email")}: {clinic.email}
            </Text>
          ) : null}
          <Text style={styles.confidential}>{t("reports.confidential")}</Text>
          {showLogo ? <Image src={clinic.logoUrl as string} style={styles.logo} /> : null}
          {qrDataUrl ? (
            <>
              <Image src={qrDataUrl} style={styles.qr} />
              <Text style={styles.qrCaption}>
                {t("reports.number")} #{report.reportNumber}
              </Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={styles.rule} />
    </>
  );

  return (
    <Document title={`${snapshot.name} #${report.reportNumber}`}>
      <Page size="A4" style={styles.page}>
        {isCanvas ? (
          // ── Canvas layout: clinic header pinned at top, each block placed by its `pos`. ──
          <View style={{ position: "relative", width: PAGE_CONTENT.width, height: PAGE_CONTENT.height }}>
            <View style={{ position: "absolute", top: 0, left: 0, width: "100%" }}>{clinicHeader}</View>
            {report.status !== "verified" ? (
              <Text style={[styles.draft, { position: "absolute", top: 54, left: 0 }]}>{t("reports.pdfDraft")}</Text>
            ) : null}
            {snapshot.sections.map((section, i) => {
              const p = section.pos ?? { x: 4, y: 14 + i * 12, w: 92 };
              return (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: (p.x / 100) * PAGE_CONTENT.width,
                    top: (p.y / 100) * PAGE_CONTENT.height,
                    width: (p.w / 100) * PAGE_CONTENT.width,
                  }}
                >
                  {renderInner(section)}
                </View>
              );
            })}
          </View>
        ) : (
          // ── Flow layout (default): clinic chrome, title, patient line, then stacked blocks. ──
          <>
            {clinicHeader}
            {report.status !== "verified" ? <Text style={styles.draft}>{t("reports.pdfDraft")}</Text> : null}
            <View style={styles.titleRow}>
              <Text style={styles.reportTitle}>{snapshot.name}</Text>
              <Text style={styles.meta}>
                {t("reports.number")} #{report.reportNumber} · {formatDate(report.createdAt, locale)}
              </Text>
            </View>
            <Text style={[styles.meta, { marginBottom: 8 }]}>
              {t("reports.patient")}: {report.patientName}
            </Text>
            {snapshot.sections.map((section, i) => (
              <View key={i}>{renderInner(section)}</View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {report.status === "verified" && report.verifiedByName
              ? `${t("reports.verifiedBy", { name: report.verifiedByName })}${
                  report.verifiedAt ? ` · ${formatDate(report.verifiedAt, locale)}` : ""
                }`
              : t("reports.pendingVerification")}
          </Text>
          <Text>
            {brand.name} · #{report.reportNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
