import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { semanticLight as c } from "@/lib/design/tokens.semantic";
import { brand } from "@/lib/branding/brand";
import { getT, formatMoney, formatDate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type { BillDetail } from "@/lib/bills";
import type { ReportClinic } from "./ReportDocument";

/**
 * Branded invoice/receipt PDF — server-side via @react-pdf/renderer from the stored bill +
 * its snapshotted line items. A fully-paid bill is titled RECEIPT, otherwise INVOICE.
 */
export interface BillDocumentProps {
  locale: Locale;
  clinic: ReportClinic;
  bill: BillDetail;
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
  tHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 3, marginTop: 8 },
  tRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.border, paddingVertical: 3 },
  th: { fontSize: 8, color: c.muted, textTransform: "uppercase" },
  td: { fontSize: 10 },
  cDesc: { width: "52%" },
  cQty: { width: "12%", textAlign: "right" },
  cUnit: { width: "18%", textAlign: "right" },
  cLine: { width: "18%", textAlign: "right" },
  totals: { marginTop: 10, marginLeft: "auto", width: "45%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 },
  totalStrong: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 3,
    marginTop: 3,
  },
  bold: { fontWeight: 700 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 4 },
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

export function BillDocument({ locale, clinic, bill }: BillDocumentProps) {
  const t = getT(locale);
  const money = (v: number) => formatMoney(v, locale);
  const showLogo = !!clinic.logoUrl && (clinic.logoUrl.startsWith("http") || clinic.logoUrl.startsWith("data:"));
  const title = bill.status === "paid" ? t("bills.pdfReceipt") : t("bills.pdfInvoice");

  return (
    <Document title={`${title} #${bill.billNumber}`}>
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
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.meta}>
            #{bill.billNumber} · {formatDate(bill.createdAt, locale)}
          </Text>
        </View>
        <Text style={[styles.meta, { marginBottom: 4 }]}>
          {t("bills.patient")}: {bill.patientName}
        </Text>

        {/* Items */}
        <View style={styles.tHead}>
          <Text style={[styles.th, styles.cDesc]}>{t("bills.description")}</Text>
          <Text style={[styles.th, styles.cQty]}>{t("bills.qty")}</Text>
          <Text style={[styles.th, styles.cUnit]}>{t("bills.unitPrice")}</Text>
          <Text style={[styles.th, styles.cLine]}>{t("bills.lineTotal")}</Text>
        </View>
        {bill.items.map((it, i) => (
          <View key={i} style={styles.tRow}>
            <Text style={[styles.td, styles.cDesc]}>{it.description}</Text>
            <Text style={[styles.td, styles.cQty]}>{String(it.quantity)}</Text>
            <Text style={[styles.td, styles.cUnit]}>{money(it.unitPrice)}</Text>
            <Text style={[styles.td, styles.cLine]}>{money(it.lineTotal)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={{ color: c.muted }}>{t("bills.subtotal")}</Text>
            <Text>{money(bill.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{ color: c.muted }}>{t("bills.discount")}</Text>
            <Text>{money(bill.discount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{ color: c.muted }}>{t("bills.taxLabel")}</Text>
            <Text>{money(bill.tax)}</Text>
          </View>
          <View style={styles.totalStrong}>
            <Text style={styles.bold}>{t("bills.total")}</Text>
            <Text style={styles.bold}>{money(bill.total)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{ color: c.muted }}>{t("bills.paid")}</Text>
            <Text>{money(bill.amountPaid)}</Text>
          </View>
          <View style={styles.totalStrong}>
            <Text style={styles.bold}>{t("bills.balance")}</Text>
            <Text style={styles.bold}>{money(bill.balance)}</Text>
          </View>
        </View>

        {/* Payments */}
        {bill.payments.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>{t("bills.payments")}</Text>
            {bill.payments.map((p, i) => (
              <View key={i} style={styles.tRow}>
                <Text style={[styles.td, { width: "40%" }]}>{money(p.amount)}</Text>
                <Text style={[styles.td, { width: "30%", color: c.muted }]}>{t(`bills.method_${p.method}`)}</Text>
                <Text style={[styles.td, { width: "30%", color: c.muted, textAlign: "right" }]}>
                  {formatDate(p.receivedAt, locale)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{clinic.name}</Text>
          <Text>
            {brand.name} · #{bill.billNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
