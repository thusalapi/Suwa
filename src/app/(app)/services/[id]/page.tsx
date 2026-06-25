import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getService } from "@/lib/catalog";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { ServiceForm } from "../ServiceForm";
import { updateServiceAction, toggleServiceActiveAction } from "../actions";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("owner");
  const { id } = await params;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  const service = await getService(user.clinicId, id);
  if (!service) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link href="/services" className="text-sm text-muted hover:text-ink">
            ← {t("services.title")}
          </Link>
          <h1 className="text-xl font-semibold text-ink">{service.name}</h1>
          {service.active ? (
            <Badge tone="success">{t("services.active")}</Badge>
          ) : (
            <Badge tone="neutral">{t("services.inactive")}</Badge>
          )}
        </div>

        <form action={toggleServiceActiveAction}>
          <input type="hidden" name="id" value={service.id} />
          <input type="hidden" name="active" value={service.active ? "false" : "true"} />
          <Button type="submit" variant="secondary">
            {service.active ? t("services.deactivate") : t("services.activate")}
          </Button>
        </form>
      </div>

      <ServiceForm
        locale={locale}
        action={updateServiceAction}
        serviceId={service.id}
        submitLabel={t("common.save")}
        initial={{
          name: service.name,
          priceRupees: (service.defaultPrice / 100).toString(),
          category: service.category ?? "",
        }}
      />
    </div>
  );
}
