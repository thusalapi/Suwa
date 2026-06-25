import { requireRole } from "@/lib/auth";
import { listClinicUsers } from "@/lib/users";
import { Badge } from "@/components/atoms/Badge";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { InviteForm } from "./InviteForm";

/** Owner-only team management: list clinic users and invite staff/doctor accounts. */
export default async function TeamPage() {
  const owner = await requireRole("owner");
  const t = getT(DEFAULT_LOCALE);
  const members = await listClinicUsers(owner.clinicId);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">{t("team.title")}</h1>
        <p className="text-sm text-muted">{t("team.subtitle")}</p>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-2 font-medium">{t("team.name")}</th>
              <th className="px-4 py-2 font-medium">{t("team.email")}</th>
              <th className="px-4 py-2 font-medium">{t("team.role")}</th>
              <th className="px-4 py-2 font-medium">{t("team.status")}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-ink">{m.name}</td>
                <td className="px-4 py-2 text-muted">{m.email}</td>
                <td className="px-4 py-2">
                  <Badge tone="neutral">{t(`roles.${m.role}`)}</Badge>
                </td>
                <td className="px-4 py-2">
                  {m.mustReset ? (
                    <Badge tone="danger">{t("team.statusPending")}</Badge>
                  ) : (
                    <Badge tone="success">{t("team.statusActive")}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink">{t("team.inviteTitle")}</h2>
          <p className="text-sm text-muted">{t("team.inviteSubtitle")}</p>
        </div>
        <InviteForm locale={DEFAULT_LOCALE} />
      </section>
    </div>
  );
}
