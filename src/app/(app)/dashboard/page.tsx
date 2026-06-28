import { requireUser } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import { StatCard } from "@/components/molecules/StatCard";
import { ActionCard } from "@/components/molecules/ActionCard";
import {
  CoinsIcon,
  ReceiptIcon,
  ClockIcon,
  WalletIcon,
  UserPlusIcon,
  FilePlusIcon,
  ClipboardIcon,
  ChartIcon,
} from "@/components/atoms/icons";
import { getT, formatMoney, formatDate } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

export default async function DashboardPage() {
  const user = await requireUser();
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);
  const money = (v: number) => formatMoney(v, locale);
  const stats = await getDashboardStats(user.clinicId);
  const isOwner = user.role === "owner";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted">{t("dashboard.welcome", { name: user.name })}</p>
        </div>
        <p className="text-sm text-muted">{formatDate(new Date(), locale)}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          tone="primary"
          icon={<CoinsIcon className="h-5 w-5" />}
          label={t("dashboard.revenueToday")}
          value={money(stats.revenueToday)}
          hint={t("dashboard.revenueTodayHint")}
          href={isOwner ? "/revenue" : undefined}
        />
        <StatCard
          tone="accent"
          icon={<ReceiptIcon className="h-5 w-5" />}
          label={t("dashboard.billsToday")}
          value={stats.billsToday}
          hint={t("dashboard.billsTodayHint", { billed: money(stats.billedToday) })}
          href="/bills"
        />
        <StatCard
          tone="warning"
          icon={<ClockIcon className="h-5 w-5" />}
          label={t("dashboard.pendingReports")}
          value={stats.pendingReports}
          hint={t("dashboard.pendingReportsHint")}
          href="/reports"
        />
        <StatCard
          tone="danger"
          icon={<WalletIcon className="h-5 w-5" />}
          label={t("dashboard.outstanding")}
          value={money(stats.outstandingBalance)}
          hint={t("dashboard.outstandingHint", { count: stats.outstandingCount })}
          href={isOwner ? "/revenue" : "/bills"}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">{t("dashboard.quickLinks")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            href="/patients/new"
            icon={<UserPlusIcon className="h-5 w-5" />}
            title={t("dashboard.newPatient")}
            subtitle={t("dashboard.newPatientHint")}
          />
          <ActionCard
            href="/bills/new"
            icon={<FilePlusIcon className="h-5 w-5" />}
            title={t("dashboard.newBill")}
            subtitle={t("dashboard.newBillHint")}
          />
          <ActionCard
            href="/reports/new"
            icon={<ClipboardIcon className="h-5 w-5" />}
            title={t("dashboard.newReport")}
            subtitle={t("dashboard.newReportHint")}
          />
          {isOwner ? (
            <ActionCard
              href="/revenue"
              icon={<ChartIcon className="h-5 w-5" />}
              title={t("dashboard.viewRevenue")}
              subtitle={t("dashboard.viewRevenueHint")}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
