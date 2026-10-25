import type { ReactNode } from "react";
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { semanticLight as c } from "@/lib/design/tokens.semantic";
import { brand } from "@/lib/branding/brand";
import { getT, formatDate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { PAGE_CONTENT, tableWidths, type Template, type Section, type ResultRow } from "@/lib/report-engine/template";
import { formatResult, type ReportData, type ResultValue } from "@/lib/report-engine/report-data";
import { isAbnormal, isCritical, type Flag } from "@/lib/report-engine/flag";
import { formatPatientValue, nameParts, noteParts, unitParts, type UnitPart } from "@/lib/report-engine/display";

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

// Wrap only at spaces — never hyphenate a word mid-way ("Break-/fast") on a medical report.
Font.registerHyphenationCallback((word) => [word]);

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
  listHeadRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingBottom: 3,
    marginBottom: 2,
  },
  listHeadCell: { fontSize: 8, color: c.muted, textTransform: "uppercase", fontWeight: 700 },
  listRow: { flexDirection: "row", paddingVertical: 3 },
  listTest: { width: "50%", fontSize: 10 },
  listResult: { width: "50%", fontSize: 10, fontWeight: 700 },
  // "dual" (value + second value) and "ranged" (value · unit · reference) columns, as on the
  // printed FBC: no grid lines, the headers underlined.
  colHead: { fontSize: 9, fontWeight: 700, textDecoration: "underline", marginTop: 10, marginBottom: 4 },
  colRow: { flexDirection: "row", paddingVertical: 3 },
  dTest: { width: "34%", paddingLeft: 12, fontSize: 10 },
  dValue: { width: "20%", fontSize: 10 },
  dValue2: { width: "46%", fontSize: 10 },
  rTest: { width: "34%", fontSize: 10 },
  rValue: { width: "14%", fontSize: 10, textAlign: "right", paddingRight: 10 },
  rUnit: { width: "18%", fontSize: 10 },
  rRange: { width: "34%", fontSize: 10 },
  remark: { fontSize: 10, fontWeight: 700, color: c.primaryDark },
  // Fixed text table (e.g. the lipid risk chart): underlined bold headers, no grid, like the print.
  fxHead: { fontSize: 8.5, fontWeight: 700, textDecoration: "underline", paddingRight: 6 },
  fxRow: { flexDirection: "row", paddingVertical: 4 },
  fxCell: { fontSize: 9, paddingRight: 6 },
  subheading: { fontSize: 9.5, fontWeight: 700, color: c.ink, marginTop: 6, marginBottom: 2 },
  // Footnote: well below the content, "Note:" label with numbered points hanging-indented.
  note: { flexDirection: "row", marginTop: 48 },
  noteLabel: { width: 34, fontSize: 8.5, color: c.muted },
  noteItem: { flexDirection: "row", marginBottom: 2 },
  noteNum: { width: 14, fontSize: 8.5, color: c.muted },
  noteText: { flex: 1, fontSize: 8.5, color: c.muted },
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

/** A test name with explicit carets raised (Na⁺, Cl⁻) — nested inside a parent <Text>. */
function PdfName({ name }: { name: string }) {
  return <PdfParts parts={nameParts(name)} />;
}

/** A unit with its powers raised (m², 10³) — nested inside a parent <Text>. */
function PdfUnit({ unit }: { unit: string | undefined }) {
  if (!unit) return null;
  return <PdfParts parts={unitParts(unit)} />;
}

function PdfParts({ parts }: { parts: UnitPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.sup ? (
          <Text key={i} style={{ verticalAlign: "super", fontSize: 7 }}>
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

function rangeLabel(row: ResultRow): string {
  if (row.ref_text) return row.ref_text;
  if (row.ref_low != null && row.ref_high != null) return `${row.ref_low} - ${row.ref_high}`;
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
  const showsPatientName = snapshot.sections.some((s) => s.type === "patient_info" && s.fields.includes("name"));

  /** The inner content for one block — shared by flow (fragment-wrapped) and canvas (absolute). */
  const renderInner = (section: Section): ReactNode => {
    switch (section.type) {
      case "static":
        if (section.note) {
          const { label, items } = noteParts(section.text);
          return (
            <View style={styles.note} wrap={false}>
              {label ? <Text style={styles.noteLabel}>{label}</Text> : null}
              <View style={{ flex: 1 }}>
                {items.map((it, j) => (
                  <View key={j} style={styles.noteItem}>
                    {it.num ? <Text style={styles.noteNum}>{it.num}</Text> : null}
                    <Text style={styles.noteText}>{it.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }
        return (
          <Text style={section.heading ? styles.sectionTitle : section.subheading ? styles.subheading : styles.meta}>
            {section.text}
          </Text>
        );

      case "patient_info":
        return (
          <View style={styles.piGrid}>
            {section.fields.map((f) => (
              <View key={f} style={styles.piRow}>
                <Text style={styles.piRowLabel}>{t(`reports.pi_${f}`)}</Text>
                <Text style={styles.piRowValue}>
                  {patientInfo[f] != null ? formatPatientValue(f, patientInfo[f]) : "-"}
                </Text>
              </View>
            ))}
          </View>
        );

      case "results_table":
        if (section.style === "dual") {
          return (
            <View wrap={false}>
              {section.title ? <Text style={styles.listTitle}>{section.title}</Text> : null}
              {section.listHeader ? (
                <View style={styles.colRow}>
                  <Text style={[styles.colHead, { width: "54%" }]}>{section.listHeader.left}</Text>
                  <Text style={[styles.colHead, { width: "46%" }]}>{section.listHeader.right}</Text>
                </View>
              ) : null}
              {section.rows.map((row) => {
                const entry = results[row.key];
                return (
                  <View key={row.key} style={styles.colRow}>
                    <Text style={styles.dTest}>
                      <PdfName name={row.test} />
                    </Text>
                    <Text style={styles.dValue}>
                      {entry ? (
                        <>
                          {formatResult(entry.value, row)} <PdfUnit unit={row.unit} />
                        </>
                      ) : (
                        "-"
                      )}
                    </Text>
                    <Text style={styles.dValue2}>
                      {entry?.value2 != null ? (
                        <>
                          {entry.value2} <PdfUnit unit={row.unit2} />
                        </>
                      ) : (
                        "-"
                      )}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }
        if (section.style === "ranged") {
          // Column widths (%): test · value · unit · range [· remarks].
          // Column widths (%): test · value · unit · range · remarks · second unit (e.g. mmol/l).
          const remarks = !!section.remarksHeader;
          const second = section.rows.some((r) => r.unit2);
          const w =
            remarks && second
              ? [26, 10, 12, 20, 16, 16]
              : remarks
                ? [30, 12, 14, 24, 20, 0]
                : second
                  ? [30, 12, 14, 24, 0, 20]
                  : [34, 14, 18, 34, 0, 0];
          return (
            <View wrap={false} style={{ marginTop: 6 }}>
              {section.title ? <Text style={styles.listTitle}>{section.title}</Text> : null}
              {section.rangeHeader || section.listHeader ? (
                <View style={styles.colRow}>
                  <Text style={[styles.colHead, { width: `${w[0]}%`, marginTop: 0 }]}>
                    {section.listHeader?.left ?? ""}
                  </Text>
                  <Text style={[styles.colHead, { width: `${w[1] + w[2]}%`, marginTop: 0 }]}>
                    {section.listHeader?.right ?? ""}
                  </Text>
                  <Text style={[styles.colHead, { width: `${w[3]}%`, marginTop: 0 }]}>{section.rangeHeader ?? ""}</Text>
                  {remarks ? (
                    <Text style={[styles.colHead, { width: `${w[4]}%`, marginTop: 0 }]}>{section.remarksHeader}</Text>
                  ) : null}
                  {second ? <Text style={{ width: `${w[5]}%` }} /> : null}
                </View>
              ) : null}
              {section.rows.map((row) => {
                const entry = results[row.key];
                const flag = entry?.flag as Flag | undefined;
                const abn = !!flag && isAbnormal(flag);
                return (
                  <View key={row.key} style={styles.colRow}>
                    <Text style={[styles.rTest, { width: `${w[0]}%` }]}>
                      <PdfName name={row.test} />
                    </Text>
                    <Text style={[styles.rValue, { width: `${w[1]}%` }, ...(abn ? [styles.abnormal] : [])]}>
                      {entry ? formatResult(entry.value, row) : "-"}
                    </Text>
                    <Text style={[styles.rUnit, { width: `${w[2]}%` }]}>
                      <PdfUnit unit={row.unit} />
                    </Text>
                    <Text style={[styles.rRange, { width: `${w[3]}%` }]}>
                      {rangeLabel(row) === "-" && !row.ref_text ? "" : rangeLabel(row)}
                    </Text>
                    {remarks ? (
                      <Text style={[styles.remark, { width: `${w[4]}%` }, ...(abn ? [styles.abnormal] : [])]}>
                        {flag ? t(`reports.flag_${flag}`) : ""}
                      </Text>
                    ) : null}
                    {second ? (
                      <Text style={[styles.rRange, { width: `${w[5]}%` }]}>
                        {entry?.value2 != null && row.unit2 ? (
                          <>
                            {entry.value2} <PdfUnit unit={row.unit2} />
                          </>
                        ) : (
                          ""
                        )}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        }
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
                  entry != null ? (
                    <>
                      {formatResult(entry.value, row)}
                      {row.unit ? " " : ""}
                      <PdfUnit unit={row.unit} />
                      {entry.value2 != null && row.unit2 ? (
                        <>
                          {`    ${entry.value2} `}
                          <PdfUnit unit={row.unit2} />
                        </>
                      ) : null}
                    </>
                  ) : (
                    "-"
                  );
                return (
                  <View key={row.key} style={styles.listRow}>
                    <Text style={styles.listTest}>
                      <PdfName name={row.test} />
                    </Text>
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
                  <Text style={[styles.td, styles.cTest]}>
                    <PdfName name={row.test} />
                  </Text>
                  <Text style={[...cell, styles.cResult]}>{entry ? formatResult(entry.value, row) : "-"}</Text>
                  <Text style={[styles.td, styles.cUnit]}>{row.unit ? <PdfUnit unit={row.unit} /> : "-"}</Text>
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

      case "table": {
        const w = tableWidths(section);
        return (
          <View wrap={false} style={{ marginTop: 14 }}>
            {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
            <View style={[styles.fxRow, { alignItems: "flex-end" }]}>
              {section.columns.map((col, i) => (
                <Text key={i} style={[styles.fxHead, { width: `${w[i]}%` }]}>
                  {col}
                </Text>
              ))}
            </View>
            {section.rows.map((row, r) => (
              <View key={r} style={styles.fxRow}>
                {row.map((cell, i) => (
                  <Text key={i} style={[styles.fxCell, { width: `${w[i]}%` }, i === 0 ? { fontWeight: 700 } : {}]}>
                    {cell}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        );
      }

      // The verifier isn't printed (the clinic signs/stamps the paper); verification still gates release.
      case "signature":
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
            {/* Only when the template doesn't already print a "Patient Name" field — never both. */}
            {showsPatientName ? null : (
              <Text style={[styles.meta, { marginBottom: 8 }]}>
                {t("reports.patient")}: {report.patientName}
              </Text>
            )}
            {snapshot.sections.map((section, i) => (
              <View key={i}>{renderInner(section)}</View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text />
          <Text>
            {brand.name} · #{report.reportNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
