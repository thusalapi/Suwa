# Report Engine

The core differentiator. A clinic's report types are **JSON templates**, and one template
drives **three outputs**:

1. A **data-entry form** (auto-generated, with live calculation and flagging)
2. A **PDF report** (the lab's own printed layout)
3. A stored **record** (queryable JSON data)

Code: `src/lib/report-engine/` (pure, Zod-only — shared by Server Actions, the form, and the
PDF). The 23 templates the pilot clinic uses live in `examples.ts` and are seeded with
`npm run seed:templates`.

## What a lab report is

Most lab reports are **tables of analytes** with reference ranges. The template defines the
rows (tests, units, ranges); staff type only the results; the engine computes the flag
(Normal / Low / High) and any **calculated** values (eGFR, LDL, absolute counts…).

## Template shape

```ts
{
  name: "Lipid Profile",
  version: 1,
  locked: true,                 // system template: read-only in the UI (see "Locked templates")
  aliases: ["lipids", "LDL"],   // extra search keywords for the report picker
  layout: "flow",               // or "canvas" (blocks placed by pos {x,y,w} in %)
  sections: [ /* blocks */ ],
}
```

### Block types

| Type | Purpose | Notable options |
|------|---------|-----------------|
| `patient_info` | Patient + specimen block (two-column "Label : Value") | `fields` from: `name` `age` `gender` (from the patient record, read-only) and `referred_by` `requested_by` `ref_doctor` `specimen_no` `datetime` `source` (typed per report). `defaultSource` prefills Source of Specimen (e.g. "Urine"; default "Blood"). |
| `static` | Fixed text | `heading`, `subheading` (small bold line), `note` (footnote: set apart below the content, "Note:" label + hanging-indented numbered points) |
| `results_table` | The analyte rows | `style`, `title`, `listHeader {left,right}`, `rangeHeader`, `remarksHeader` — see styles below |
| `table` | A fixed text table (e.g. the lipid risk chart) | `columns`, `rows` (cells may contain `\n`), optional relative `widths` |
| `field` | A single typed value | `inputType` text / number / date / select |
| `textarea` | Free text (comments) | |
| `signature` | Verifier block | Kept in templates, **not printed** (the clinic signs/stamps the paper) |

### `results_table` styles

| Style | PDF layout | Used by |
|-------|-----------|---------|
| `table` (default) | Test · Result · Unit · Reference range · Flag | generic / user-built templates |
| `list` | Test — Result (result shows value, unit, and any second unit) | FBS, PPBS, Urine Full Report, HbA1c, ESR |
| `dual` | Test · value unit · second value unit | FBC differential % beside absolute count |
| `ranged` | Test · value · unit · REF.RANGE [· REMARKS] [· second unit] | most chemistry reports |

`ranged` adds a **REMARKS** column when `remarksHeader` is set (Normal / Low / High in words,
from the stored flag) and a second-unit column when any row has `unit2` (e.g. mmol/l).

### Result rows

| Field | Meaning |
|-------|---------|
| `key`, `test`, `unit` | Identifier (snake_case), printed name, unit |
| `value_type` | `"number"` (default, flagged) or `"text"` (qualitative, e.g. "Nil", "B Positive") |
| `suggestions` | Typing suggestions for text rows (Nil / Trace / + …); free text still allowed |
| `ref_low`, `ref_high`, `critical_low`, `critical_high` | Numeric bounds used for flagging |
| `ref_text` | The range **as printed** ("120-200 mg/dl", "<130 mg/dl", "(3.0-5.0)"). Display only |
| `formula` | **Calculated row** — the value is computed, never typed (see Formulas) |
| `formula2` + `unit2` | A calculated **second value** (e.g. absolute count `wbc * neut / 100`) |
| `factor2` + `unit2` | Second value = value × factor, **cut off** to 1 decimal (mg/dl → mmol/l: × 0.0555) |
| `decimals` / `decimals2` | Decimal places: calculated values are rounded to this, and every value is **shown** with exactly this many (57.5 → "57.50") |

Names and units are display-formatted, never stored formatted:
- Units raise powers: `ml/min/1.73 m2` → m², `x10^9/L` → 10⁹.
- Test names raise explicit carets only: `Serum Na^+` → Na⁺.

## Formulas

`formula.ts` parses a tiny arithmetic language — **never `eval`'d**, so a template can't run
code:

- numbers, row keys, `+ - * / ^`, parentheses, unary minus
- functions `min(a, b, …)`, `max(a, b, …)`, `trunc(x, places)` (cut off, don't round)
- patient variables `age` (years), `male` / `female` (1 or 0), taken from the **patient
  record**, never from the form

Rules:
- A formula may only reference numeric rows; templates are validated for syntax, unknown keys
  and cycles.
- Calculated rows are evaluated in dependency order and see the **rounded** values of earlier
  rows, so the printed numbers agree with each other (MCV uses the printed RBC).
- A calculated value is blank until every input exists (or on divide-by-zero).
- Values are computed on entry and **stored** with the report; the PDF never recomputes.

The formulas in use (worked examples in the clinic verification sheet):

| Report | Calculation |
|--------|-------------|
| Full Blood Count | absolute = WBC × % ÷ 100; RBC = PCV ÷ 9; MCHC = Hb × 100 ÷ PCV; MCH = Hb × 10 ÷ RBC; MCV = PCV × 10 ÷ RBC |
| Serum Creatinine | eGFR, CKD-EPI 2021: `142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.2 × 0.9938^age × 1.012 [female]`, κ 0.7/0.9, α −0.241/−0.302 |
| Urine Microalbumin | ACR (mg/g) = microalbumin (mg/l) ÷ creatinine (mg/dl) × 100 |
| Lipid Profile | VLDL = TG ÷ 5; LDL = TC − HDL − VLDL; ratio = TC ÷ HDL |
| Liver Profile / Total Protein | Globulin = Total Protein − Albumin; A/G = Albumin ÷ Globulin, cut off to 2 dp |
| Bilirubin | Indirect = Total − Direct |
| FBS / RBS / PPBS | mmol/l = mg/dl × 0.0555, cut off to 1 dp |

## Flagging

```
value <= critical_low              -> "critical_low"
value >= critical_high             -> "critical_high"
value <  ref_low                   -> "low"
value >  ref_high                  -> "high"
otherwise                          -> "normal"
```

A value **equal to a limit is Normal**. A row with **no bounds shows no flag or remark**
(e.g. pH, Indirect Bilirubin) even though a placeholder flag is stored. Flags are stored at
entry, never recomputed at render. Abnormal values print bold red; REMARKS says Low / High.

## Filled report data (JSONB on `reports.data`)

```json
{
  "patient_info": { "name": "…", "age": 67, "gender": "male", "datetime": "2026-10-24T11:16", "source": "Blood" },
  "results": {
    "scr":  { "value": 1.32,  "flag": "high" },
    "egfr": { "value": 59.12, "flag": "low" },
    "fbs":  { "value": 101,   "flag": "normal", "value2": 5.6 },
    "colour": { "value": "Straw" }
  }
}
```

`datetime` (the specimen Date & Time) is **prefilled with now** on a new report and decides
which **visit** the report belongs to (see data-model.md).

## Lifecycle & reproducibility

```
choose template ─► form (live calc + flags) ─► save draft (snapshot frozen, values stored)
                                                  │
                                    edit draft (re-calculated against the SAME snapshot)
                                                  │
                                     verify ─► verified (immutable) ─► PDF
```

- On creation the **full template is frozen** into `reports.template_snapshot`; later template
  edits never change an issued report.
- Editing a template bumps its version; old reports keep their snapshot.
- A report is released only after **verification** (`status = verified`); unverified PDFs carry
  a DRAFT banner.
- `report_number` is gap-free per clinic.

## Locked templates

Every template seeded from `examples.ts` is **locked**: the edit page shows a read-only
preview and the server refuses updates (`TemplateLockedError`). Only `seed:templates` changes
them. The UI can neither set nor carry the `locked` flag, so clinic-built templates are always
editable. `seed:templates` is idempotent: it creates missing templates, and locks + refreshes
search keywords on existing ones in place (no version bump); `--replace "<name>"` overwrites a
template's content as a new version.

## Renderers

- **Form** — `components/forms/ReportFormRenderer.tsx`: inputs for typed rows, read-only live
  values for calculated rows, typing suggestions, live flags.
- **View** — `components/organisms/ReportView.tsx` (+ `FixedTable`).
- **PDF** — `components/pdf/ReportDocument.tsx`: clinic header from Settings, patient block, the
  blocks above, and the clinic's **footer line** (Settings → Footer text) on every page. No app
  branding is printed.

## Template builder

`app/(app)/templates/TemplateBuilder.tsx` lets an owner build templates visually (blocks,
rows, flow or canvas layout, drag to reorder). It carries every advanced field it has no editor
for (formulas, styles, suggestions, tables, aliases) through an edit-save unchanged.
