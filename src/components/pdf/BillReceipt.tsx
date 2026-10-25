import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { getT, formatMoney, formatDateTime } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type { BillDetail } from "@/lib/bills";
import type { ReportClinic } from "./ReportDocument";

/**
 * POS / thermal-printer receipt for a bill: 80 mm wide, black on white, no colour or logo (thermal
 * heads print one shade). The page is exactly as long as its content, so the printer feeds no blank
 * paper; `receiptHeight` estimates that length from the bill.
 */
export interface BillReceiptProps {
  locale: Locale;
  clinic: ReportClinic;
  bill: BillDetail;
}

/** 80 mm in PDF points (1 mm = 72 / 25.4 pt). */
export const RECEIPT_WIDTH = (80 * 72) / 25.4;
const MARGIN = 10;
/** Roughly how many characters of 8.5 pt Helvetica fit on one line of the item column. */
const CHARS_PER_LINE = 34;
const LINE = 11;

/** Page height in points: the content's height plus a little slack, so nothing spills to a 2nd page. */
export function receiptHeight(clinic: ReportClinic, bill: BillDetail): number {
  const addressLines = clinic.address ? clinic.address.split(/\r?\n/).length : 0;
  const contactLines = [clinic.phone, clinic.fax, clinic.email].filter(Boolean).length;
  const itemLines = bill.items.reduce(
    (n, it) => n + Math.ceil(Math.max(it.description.length, 1) / CHARS_PER_LINE) + 1,
    0,
  );
  const totalLines = 3 + (bill.discount ? 1 : 0) + (bill.tax ? 1 : 0); // subtotal, total, paid, balance…
  const paymentLines = bill.payments.length ? bill.payments.length + 1 : 0;
  const footerLines = clinic.footerNote ? Math.ceil(clinic.footerNote.length / 40) : 0;
  const lines = 2 + addressLines + contactLines + 4 + itemLines + totalLines + 1 + paymentLines + 2 + footerLines;
  return Math.ceil(MARGIN * 2 + lines * LINE + 6 * 8 /* dashed rules */ + 30 /* slack */);
}

const styles = StyleSheet.create({
  page: { padding: MARGIN, fontSize: 8.5, color: "#000000", fontFamily: "Helvetica" },
  center: { textAlign: "center" },
  clinicName: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 2 },
  small: { fontSize: 7.5, textAlign: "center" },
  rule: { borderBottomWidth: 0.75, borderBottomColor: "#000000", borderBottomStyle: "dashed", marginVertical: 5 },
  title: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center", letterSpacing: 1, marginBottom: 3 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1.5 },
  label: { color: "#000000" },
  bold: { fontFamily: "Helvetica-Bold" },
  item: { marginBottom: 3 },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
});

export function BillReceipt({ locale, clinic, bill }: BillReceiptProps) {
  const t = getT(locale);
  const money = (v: number) => formatMoney(v, locale);
  const title = bill.status === "paid" ? t("bills.pdfReceipt") : t("bills.pdfInvoice");

  return (
    <Document title={`${title} #${bill.billNumber}`}>
      <Page size={[RECEIPT_WIDTH, receiptHeight(clinic, bill)]} style={styles.page}>
        {/* Clinic */}
        <Text style={styles.clinicName}>{clinic.name}</Text>
        {clinic.address ? <Text style={styles.small}>{clinic.address}</Text> : null}
        {clinic.phone ? (
          <Text style={styles.small}>
            {t("reports.tel")}: {clinic.phone}
          </Text>
        ) : null}
        {clinic.fax ? (
          <Text style={styles.small}>
            {t("reports.fax")}: {clinic.fax}
          </Text>
        ) : null}
        {clinic.email ? <Text style={styles.small}>{clinic.email}</Text> : null}
        <View style={styles.rule} />

        {/* Bill */}
        <Text style={styles.title}>{title}</Text>
        <View style={styles.row}>
          <Text>{t("bills.receiptNo")}</Text>
          <Text style={styles.bold}>#{bill.billNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text>{t("bills.receiptDate")}</Text>
          <Text>{formatDateTime(bill.createdAt)}</Text>
        </View>
        <View style={styles.row}>
          <Text>{t("bills.patient")}</Text>
          <Text style={{ maxWidth: "65%", textAlign: "right" }}>{bill.patientName}</Text>
        </View>
        <View style={styles.rule} />

        {/* Items: description, then "qty x price" and the line total */}
        {bill.items.map((it, i) => (
          <View key={i} style={styles.item} wrap={false}>
            <Text>{it.description}</Text>
            <View style={styles.row}>
              <Text>
                {String(it.quantity)} x {money(it.unitPrice)}
              </Text>
              <Text>{money(it.lineTotal)}</Text>
            </View>
          </View>
        ))}
        <View style={styles.rule} />

        {/* Totals */}
        <View style={styles.row}>
          <Text>{t("bills.subtotal")}</Text>
          <Text>{money(bill.subtotal)}</Text>
        </View>
        {bill.discount ? (
          <View style={styles.row}>
            <Text>{t("bills.discount")}</Text>
            <Text>-{money(bill.discount)}</Text>
          </View>
        ) : null}
        {bill.tax ? (
          <View style={styles.row}>
            <Text>{t("bills.taxLabel")}</Text>
            <Text>{money(bill.tax)}</Text>
          </View>
        ) : null}
        <View style={styles.total}>
          <Text>{t("bills.total")}</Text>
          <Text>{money(bill.total)}</Text>
        </View>
        <View style={[styles.row, { marginTop: 3 }]}>
          <Text>{t("bills.paid")}</Text>
          <Text>{money(bill.amountPaid)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.bold}>{t("bills.balance")}</Text>
          <Text style={styles.bold}>{money(bill.balance)}</Text>
        </View>

        {/* Payments */}
        {bill.payments.length > 0 ? (
          <>
            <View style={styles.rule} />
            {bill.payments.map((p, i) => (
              <View key={i} style={styles.row}>
                <Text>
                  {t(`bills.method_${p.method}`)} · {formatDateTime(p.receivedAt)}
                </Text>
                <Text>{money(p.amount)}</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={styles.rule} />
        <Text style={[styles.center, styles.bold]}>{t("bills.receiptThanks")}</Text>
        {clinic.footerNote ? <Text style={[styles.small, { marginTop: 3 }]}>{clinic.footerNote}</Text> : null}
      </Page>
    </Document>
  );
}
