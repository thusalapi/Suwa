"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/atoms/Input";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";

export interface TemplatePickerItem {
  id: string;
  name: string;
  version: number;
  /** Short names the lab uses (PPBS, LFT…) — searched as well as the name. */
  aliases?: string[];
}

/** Lowercase letters and digits only, so "S.G.O.T." / "sgot" and "Glyco - Haemoglobin" / "glyco" match. */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** First letter of each word: "Postprandial Blood Sugar" → "pbs", "Fasting Blood Sugar" → "fbs". */
const initials = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("");

/** True when every word of the query appears in the text, or the query is the text's initials. */
function matchesText(name: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).map(squash).filter(Boolean);
  if (words.length === 0) return true;
  const flat = squash(name);
  return words.every((w) => flat.includes(w)) || initials(name).startsWith(squash(query));
}

/** Match a report by its name or any of its short names (aliases). */
export function matchesTemplate(name: string, query: string, aliases: string[] = []): boolean {
  return [name, ...aliases].some((text) => matchesText(text, query));
}

/**
 * The "choose a report" step: a search box over the clinic's templates. Enter opens the first match,
 * so a lab tech can type "lipid ⏎" and land straight on the form.
 */
export function TemplatePicker({
  locale,
  patientId,
  templates,
}: {
  locale: Locale;
  patientId: string;
  templates: TemplatePickerItem[];
}) {
  const t = getT(locale);
  const router = useRouter();
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => [...templates].sort((a, b) => a.name.localeCompare(b.name)), [templates]);
  const matches = sorted.filter((tpl) => matchesTemplate(tpl.name, query, tpl.aliases));
  const href = (id: string) => `/reports/new?patientId=${patientId}&templateId=${id}`;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="template-search" className="block text-sm font-medium text-ink">
          {t("reports.searchTemplates")}
        </label>
        <Input
          id="template-search"
          type="search"
          autoFocus
          autoComplete="off"
          value={query}
          placeholder={t("reports.searchTemplatesPlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              router.push(href(matches[0].id));
            }
          }}
          className="max-w-md"
        />
      </div>

      {matches.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised px-4 py-8 text-center text-sm text-muted">
          {t("reports.noTemplateMatch", { q: query.trim() })}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {matches.map((tpl) => (
            <li key={tpl.id}>
              <Link
                href={href(tpl.id)}
                className="block rounded-lg border border-border bg-surface-raised p-4 hover:bg-surface"
              >
                <span className="font-medium text-ink">{tpl.name}</span>
                <span className="block text-xs text-muted">v{tpl.version}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
