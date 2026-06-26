import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import { StatCard } from "@/components/molecules/StatCard";
import { Button } from "@/components/atoms/Button";
import { getT, formatMoney } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

export default async function DashboardPage() {
  const user = await requireUser();
  const t = getT(DEFAULT_LOCALE);
  const money = (v: number) => formatMoney(v, DEFAULT_LOCALE);
  const stats = await getDashboardStats(user.clinicId);
  const isOwner = user.role === "owner";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted">{t("dashboard.welcome", { name: user.name })}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.revenueToday")}
          value={money(stats.revenueToday)}
          hint={t("dashboard.revenueTodayHint")}
        />
        <StatCard
          label={t("dashboard.billsToday")}
          value={stats.billsToday}
          hint={t("dashboard.billsTodayHint", { billed: money(stats.billedToday) })}
        />
        <StatCard
          label={t("dashboard.pendingReports")}
          value={stats.pendingReports}
          hint={t("dashboard.pendingReportsHint")}
        />
        <StatCard
          label={t("dashboard.outstanding")}
          value={money(stats.outstandingBalance)}
          hint={t("dashboard.outstandingHint", { count: stats.outstandingCount })}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted">{t("dashboard.quickLinks")}</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/patients/new">
            <Button variant="secondary">{t("dashboard.newPatient")}</Button>
          </Link>
          <Link href="/bills/new">
            <Button variant="secondary">{t("dashboard.newBill")}</Button>
          </Link>
          <Link href="/reports/new">
            <Button variant="secondary">{t("dashboard.newReport")}</Button>
          </Link>
          {isOwner ? (
            <Link href="/revenue">
              <Button variant="secondary">{t("dashboard.viewRevenue")}</Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
