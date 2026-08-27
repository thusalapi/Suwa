"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { UserPlusIcon } from "@/components/atoms/icons";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type { PatientListItem } from "@/lib/patients";
import { searchPatientsAction } from "@/app/(app)/patients/actions";

/** Which action the finder emphasises — drives the primary button + Enter target. */
export type FinderMode = "all" | "bill" | "report";

export interface PatientFinderProps {
  locale: Locale;
  /** SSR'd so results show instantly (and without JS via the GET fallback). */
  initialQuery: string;
  initialResults: PatientListItem[];
  mode?: FinderMode;
}

const isPhoneish = (q: string) => /^[0-9+\s-]{3,}$/.test(q.trim());

function registerHref(query: string): string {
  const q = query.trim();
  if (!q) return "/patients/new";
  const key = isPhoneish(q) ? "phone" : "name";
  return `/patients/new?${key}=${encodeURIComponent(q)}`;
}

/**
 * Fast patient lookup for the rush counter: type a phone/name and act in one click. Live search
 * (debounced server action) with SSR'd initial results, inline Bill/Report/Open actions per row,
 * and a "register new" shortcut that carries the typed number. Pressing Enter without JS falls
 * back to the `/patients?q=` page.
 */
export function PatientFinder({ locale, initialQuery, initialResults, mode = "all" }: PatientFinderProps) {
  const t = getT(locale);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PatientListItem[]>(initialResults);
  const [pending, startTransition] = useTransition();
  const latest = useRef(initialQuery);
  const mounted = useRef(false);

  useEffect(() => {
    // The first render already has SSR'd results — only search once the query changes.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    latest.current = query;
    const id = setTimeout(() => {
      const q = query;
      startTransition(async () => {
        const rows = await searchPatientsAction(q);
        if (latest.current === q) setResults(rows); // ignore stale responses
      });
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  const trimmed = query.trim();

  return (
    <div className="space-y-4">
      <form action="/patients" method="get" role="search" onSubmit={(e) => e.preventDefault()} className="relative max-w-lg">
        <label htmlFor="finder" className="sr-only">
          {t("patients.searchLabel")}
        </label>
        <Input
          id="finder"
          name="q"
          type="search"
          autoFocus
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("patients.searchPlaceholder")}
          className="pr-10"
        />
        {pending ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner label={t("common.search")} />
          </span>
        ) : null}
      </form>

      {results.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          <p>{trimmed ? t("patients.noResults") : t("patients.empty")}</p>
          <Link
            href={registerHref(query)}
            className="inline-flex items-center gap-1.5 font-medium text-primary-dark hover:underline"
          >
            <UserPlusIcon className="h-4 w-4" />
            {trimmed ? t("patients.registerNew", { q: trimmed }) : t("patients.add")}
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
            {results.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface">
                <Link href={`/patients/${p.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink hover:text-primary-dark">{p.fullName}</span>
                  <span className="text-xs text-muted">
                    {p.phone}
                    {p.nic ? ` · ${p.nic}` : ""}
                  </span>
                </Link>
                <div className="flex shrink-0 gap-2">
                  <Link href={`/bills/new?patientId=${p.id}`}>
                    <Button size="sm" variant={mode === "bill" ? "primary" : "secondary"}>
                      {t("patients.newBill")}
                    </Button>
                  </Link>
                  <Link href={`/reports/new?patientId=${p.id}`}>
                    <Button size="sm" variant={mode === "report" ? "primary" : "secondary"}>
                      {t("patients.newReport")}
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {trimmed ? (
            <Link
              href={registerHref(query)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-dark hover:underline"
            >
              <UserPlusIcon className="h-4 w-4" />
              {t("patients.registerNew", { q: trimmed })}
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}
