import { tableWidths, type TableSection } from "@/lib/report-engine/template";

/** A template's fixed text table (e.g. a lipid risk chart) — same on the entry form and the report view. */
export function FixedTable({ section }: { section: TableSection }) {
  const widths = tableWidths(section);
  return (
    <section className="space-y-2">
      {section.title ? <h3 className="text-sm font-semibold text-ink">{section.title}</h3> : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface-raised">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: `${w}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              {section.columns.map((c, i) => (
                <th key={i} className="px-3 py-2 align-bottom font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, r) => (
              <tr key={r} className="border-b border-border last:border-0 align-top">
                {row.map((cell, i) => (
                  <td
                    key={i}
                    className={
                      i === 0
                        ? "whitespace-pre-line px-3 py-2 font-medium text-ink"
                        : "whitespace-pre-line px-3 py-2 text-ink"
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
