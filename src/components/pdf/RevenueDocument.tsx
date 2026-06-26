import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { semanticLight as c } from "@/lib/design/tokens.semantic";
import { brand } from "@/lib/branding/brand";
import { getT, formatMoney, formatDate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type { RevenueReport } from "@/lib/analytics";
import type { ReportClinic } from "./ReportDocument";

/** Branded revenue-report PDF — summary, per-service breakdown, and outstanding balances. */
export interface RevenueDocumentProps {
  locale: Locale;
  clinic: ReportClinic;
  report: RevenueReport;
}

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, color: c.ink },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  clinicName: { fontSize: 16, fontWeight: 700, color: c.primaryDark },
  clinicMeta: { fontSize: 9, color: c.muted, marginTop: 2 },
  logo: { width: 96, height: 40, objectFit: "contain" },
  rule: { borderBottomWidth: 1, borderBottomColor: c.border, marginVertical: 8 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  docTitle: { fontSize: 14, fontWeight: 700, letterSpacing: 1 },
  meta: { fontSize: 9, color: c.muted },
  summary: { flexDirection: "row", marginTop: 8, marginBottom: 4 },
  summaryCell: { width: "25%" },
  summaryLabel: { fontSize: 8, color: c.muted, textTransform: "uppercase" },
  summaryValue: { fontSize: 12, fontWeight: 700, marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 4 },
  tHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 3 },
  tRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.border, paddingVertical: 3 },
  th: { fontSize: 8, color: c.muted, textTransform: "uppercase" },
  td: { fontSize: 10 },
  right: { textAlign: "right" },
  empty: { fontSize: 9, color: c.muted, marginTop: 4 },
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

export function RevenueDocument({ locale, clinic, report }: RevenueDocumentProps) {
  const t = getT(locale);
  const money = (v: number) => formatMoney(v, locale);
  const showLogo =
    !!clinic.logoUrl && (clinic.logoUrl.startsWith("http") || clinic.logoUrl.startsWith("data:"));
  const outstandingTotal = report.outstandingTotal;

  return (
    <Document title={`${t("revenue.pdfTitle")} ${report.from}–${report.to}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.clinicName}>{clinic.name}</Text>
            {clinic.address ? <Text style={styles.clinicMeta}>{clinic.address}</Text> : null}
            {clinic.phone ? <Text style={styles.clinicMeta}>{clinic.phone}</Text> : null}
          </View>
          {showLogo ? <Image src={clinic.logoUrl as string} style={styles.logo} /> : null}
        </View>
        <View style={styles.rule} />

        <View style={styles.titleRow}>
          <Text style={styles.docTitle}>{t("revenue.pdfTitle")}</Text>
          <Text style={styles.meta}>{t("revenue.rangeLabel", { from: report.from, to: report.to })}</Text>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>{t("revenue.billed")}</Text>
            <Text style={styles.summaryValue}>{money(report.billed)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>{t("revenue.collected")}</Text>
            <Text style={styles.summaryValue}>{money(report.collected)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>{t("revenue.billCount")}</Text>
            <Text style={styles.summaryValue}>{String(report.billCount)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>{t("revenue.outstandingTotal")}</Text>
            <Text style={styles.summaryValue}>{money(outstandingTotal)}</Text>
          </View>
        </View>

        {/* Revenue by service */}
        <Text style={styles.sectionTitle}>{t("revenue.byService")}</Text>
        {report.byService.length === 0 ? (
          <Text style={styles.empty}>{t("revenue.noService")}</Text>
        ) : (
          <View>
            <View style={styles.tHead}>
              <Text style={[styles.th, { width: "60%" }]}>{t("revenue.service")}</Text>
              <Text style={[styles.th, styles.right, { width: "15%" }]}>{t("revenue.qty")}</Text>
              <Text style={[styles.th, styles.right, { width: "25%" }]}>{t("revenue.amount")}</Text>
            </View>
            {report.byService.map((s, i) => (
              <View key={i} style={styles.tRow}>
                <Text style={[styles.td, { width: "60%" }]}>{s.description}</Text>
                <Text style={[styles.td, styles.right, { width: "15%" }]}>{String(s.quantity)}</Text>
                <Text style={[styles.td, styles.right, { width: "25%" }]}>{money(s.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Outstanding payments */}
        <Text style={styles.sectionTitle}>{t("revenue.outstanding")}</Text>
        {report.outstanding.length === 0 ? (
          <Text style={styles.empty}>{t("revenue.noOutstanding")}</Text>
        ) : (
          <View>
            <View style={styles.tHead}>
              <Text style={[styles.th, { width: "12%" }]}>{t("revenue.number")}</Text>
              <Text style={[styles.th, { width: "38%" }]}>{t("revenue.patient")}</Text>
              <Text style={[styles.th, styles.right, { width: "17%" }]}>{t("revenue.total")}</Text>
              <Text style={[styles.th, styles.right, { width: "17%" }]}>{t("revenue.balance")}</Text>
              <Text style={[styles.th, styles.right, { width: "16%" }]}>{t("revenue.created")}</Text>
            </View>
            {report.outstanding.map((o) => (
              <View key={o.id} style={styles.tRow}>
                <Text style={[styles.td, { width: "12%" }]}>#{String(o.billNumber)}</Text>
                <Text style={[styles.td, { width: "38%" }]}>{o.patientName}</Text>
                <Text style={[styles.td, styles.right, { width: "17%" }]}>{money(o.total)}</Text>
                <Text style={[styles.td, styles.right, { width: "17%" }]}>{money(o.balance)}</Text>
                <Text style={[styles.td, styles.right, { width: "16%" }]}>{formatDate(o.createdAt, locale)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>{clinic.name}</Text>
          <Text>
            {brand.name} · {t("revenue.pdfTitle")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
