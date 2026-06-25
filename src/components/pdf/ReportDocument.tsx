import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { semanticLight as c } from "@/lib/design/tokens.semantic";
import { brand } from "@/lib/branding/brand";
import { getT, formatDate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type { Template, ResultRow } from "@/lib/report-engine/template";
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
  logoUrl: string | null;
}

export interface ReportDocumentProps {
  locale: Locale;
  clinic: ReportClinic;
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
  logo: { width: 96, height: 40, objectFit: "contain" },
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

export function ReportDocument({ locale, clinic, report }: ReportDocumentProps) {
  const t = getT(locale);
  const { snapshot, data } = report;
  const results = (data.results ?? {}) as Record<string, ResultValue>;
  const patientInfo = (data.patient_info ?? {}) as Record<string, string | number>;
  const showLogo =
    !!clinic.logoUrl && (clinic.logoUrl.startsWith("http") || clinic.logoUrl.startsWith("data:"));

  return (
    <Document title={`${snapshot.name} #${report.reportNumber}`}>
      <Page size="A4" style={styles.page}>
        {/* Clinic header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.clinicName}>{clinic.name}</Text>
            {clinic.address ? <Text style={styles.clinicMeta}>{clinic.address}</Text> : null}
            {clinic.phone ? <Text style={styles.clinicMeta}>{clinic.phone}</Text> : null}
          </View>
          {showLogo ? <Image src={clinic.logoUrl as string} style={styles.logo} /> : null}
        </View>
        <View style={styles.rule} />

        {report.status !== "verified" ? <Text style={styles.draft}>{t("reports.pdfDraft")}</Text> : null}

        {/* Report title + number */}
        <View style={styles.titleRow}>
          <Text style={styles.reportTitle}>{snapshot.name}</Text>
          <Text style={styles.meta}>
            {t("reports.number")} #{report.reportNumber} · {formatDate(report.createdAt, locale)}
          </Text>
        </View>
        <Text style={[styles.meta, { marginBottom: 8 }]}>
          {t("reports.patient")}: {report.patientName}
        </Text>

        {/* Sections */}
        {snapshot.sections.map((section, i) => {
          switch (section.type) {
            case "static":
              return (
                <Text key={i} style={section.heading ? styles.sectionTitle : styles.meta}>
                  {section.text}
                </Text>
              );

            case "patient_info":
              return (
                <View key={i} style={styles.piGrid}>
                  {section.fields.map((f) => (
                    <View key={f} style={styles.piItem}>
                      <Text style={styles.piLabel}>{t(`reports.pi_${f}`)}</Text>
                      <Text style={styles.piValue}>
                        {patientInfo[f] != null ? String(patientInfo[f]) : "-"}
                      </Text>
                    </View>
                  ))}
                </View>
              );

            case "results_table":
              return (
                <View key={i} wrap={false}>
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
                        style={
                          flag && isCritical(flag)
                            ? [styles.tRow, { backgroundColor: "#FEECEC" }]
                            : styles.tRow
                        }
                      >
                        <Text style={[styles.td, styles.cTest]}>{row.test}</Text>
                        <Text style={[...cell, styles.cResult]}>{entry ? String(entry.value) : "-"}</Text>
                        <Text style={[styles.td, styles.cUnit]}>{row.unit || "-"}</Text>
                        <Text style={[styles.td, styles.cRange]}>{rangeLabel(row)}</Text>
                        <Text style={[...cell, styles.cFlag]}>
                          {flag ? t(`reports.flag_${flag}`) : "-"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );

            case "field": {
              const value = data[section.key];
              return (
                <View key={i}>
                  <Text style={styles.fieldLabel}>{section.label}</Text>
                  <Text style={styles.fieldValue}>
                    {value != null && value !== "" ? String(value) : "-"}
                  </Text>
                </View>
              );
            }

            case "textarea": {
              const value = data[section.key];
              return (
                <View key={i}>
                  <Text style={styles.fieldLabel}>{section.label}</Text>
                  <Text style={styles.fieldValue}>
                    {value != null && value !== "" ? String(value) : "-"}
                  </Text>
                </View>
              );
            }

            case "signature":
              return (
                <Text key={i} style={[styles.meta, { marginTop: 16 }]}>
                  {section.label}:{" "}
                  {report.status === "verified" && report.verifiedByName
                    ? report.verifiedByName
                    : t("reports.pendingVerification")}
                </Text>
              );

            default:
              return null;
          }
        })}

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
