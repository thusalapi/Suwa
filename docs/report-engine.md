# Report Engine

The core differentiator. A clinic can define its own report types (blood, urine, etc.)
that drive **three outputs from one schema**:

1. A **data-entry form** (auto-generated)
2. A **PDF report** (branded, verified)
3. A stored **record** (queryable JSON data)

> **Key insight:** the hard part is not drag-and-drop — it's the **schema + renderer**.
> Drag-and-drop is just a nicer editor producing the same schema, so it ships last.

## What a medical report actually is

Most lab reports are **tables of analytes** with reference ranges, not free-form text:

| Test | Result | Unit | Reference Range | Flag |
|------|--------|------|-----------------|------|
| Hemoglobin | 14.2 | g/dL | 13.0–17.0 | Normal |
| WBC | 12.1 | ×10³/µL | 4.0–11.0 | **High** |

The template defines the **rows** (which tests, their units, their reference ranges).
Data entry fills only the **Result** column. The engine **auto-computes the flag** by
comparing the entered value to the range.

## Block types

| Type | Purpose | Notes |
|------|---------|-------|
| `static` | Headings, labels, fixed text | Not editable at data entry |
| `patient_info` | Auto-filled patient fields | name, age, gender, referring doctor |
| `field` | Single value | text / number / date / select |
| `results_table` | The star — analyte rows | units + reference ranges + auto-flag |
| `textarea` | Comments / impression / interpretation | free text |
| `signature` | Verifier sign-off block | who verified, when |

## Template schema (stored as JSONB)

```json
{
  "name": "Full Blood Count",
  "version": 3,
  "sections": [
    {
      "type": "patient_info",
      "fields": ["name", "age", "gender", "ref_doctor"]
    },
    {
      "type": "results_table",
      "title": "Full Blood Count (FBC)",
      "rows": [
        { "key": "hb",  "test": "Hemoglobin", "unit": "g/dL",      "ref_low": 13.0, "ref_high": 17.0 },
        { "key": "wbc", "test": "WBC",        "unit": "x10^3/uL",  "ref_low": 4.0,  "ref_high": 11.0 }
      ]
    },
    { "type": "textarea",  "key": "comments", "label": "Comments" },
    { "type": "signature", "label": "Verified by" }
  ]
}
```

### Filled report data (JSONB on the report)

```json
{
  "patient_info": { "name": "...", "age": 34, "gender": "male", "ref_doctor": "Dr. X" },
  "results": {
    "hb":  { "value": 14.2, "flag": "normal" },
    "wbc": { "value": 12.1, "flag": "high" }
  },
  "comments": "Mild leukocytosis."
}
```

## Flagging logic

```
value < ref_low                       -> "low"
value > ref_high                      -> "high"
value <= critical_low (if defined)    -> "critical_low"
value >= critical_high (if defined)   -> "critical_high"
otherwise                             -> "normal"
```

Flags are computed on entry and **stored** with the value (don't recompute at render —
the issued report must be reproducible). Display: normal = plain, high/low = bold,
critical = bold + highlighted.

## Lifecycle & reproducibility

```
choose template ─► load schema ─► auto-build form
       │                               │
       │                       staff enter values
       ▼                               ▼
freeze template_snapshot ─────► save report (draft)
       │
       ▼
doctor verifies ─► status = verified ─► render PDF from (snapshot + data)
```

- On report creation, **freeze the full template schema** into
  `reports.template_snapshot`. Later template edits (new range, extra test) must not
  change already-issued reports.
- Editing a template bumps `report_templates.version`; new reports use the new version,
  old reports keep their snapshot.
- A report is only released after **doctor/verifier sign-off** (`status = verified`).
- Each report gets a unique, gap-free `report_number` (optionally encoded as a QR code
  on the PDF for authenticity).

## Renderer responsibilities

A single renderer interprets the schema for two targets:

1. **Form renderer** (`src/components/forms/`) — walks `sections`, emits inputs:
   - `patient_info` → prefilled, mostly read-only fields
   - `results_table` → a row per analyte with a single editable Result input + live flag
   - `field` / `textarea` → standard inputs
   - validated with **Zod** schemas derived from the template

2. **PDF renderer** (`src/components/pdf/`) — same schema walk, emits
   `@react-pdf/renderer` elements: clinic header (logo/name/address), patient block,
   results table(s) with flags, comments, signature, report number/QR, footer.

## Phasing

| Phase | What | When |
|-------|------|------|
| **1 — Engine** | Schema + form renderer + PDF renderer + flagging. Templates hand-built **with** the clinic and stored as JSON. | MVP / first revenue |
| **2 — Form editor** | A UI to add sections, rows, ranges — staff create their own templates (no drag-drop). | Post-revenue |
| **3 — Drag-and-drop** | Visual canvas builder (`dnd-kit`) with live preview. Same schema underneath. | Selling/UX upgrade |

Most business value lands in Phase 1–2. Phase 3 is polish, not a prerequisite.

## First data-gathering task (before building Phase 1)

Sit with the design-partner clinic and capture the **exact** definition of their top
3–5 report types:
- every test/analyte name
- its unit
- its reference range (note if it varies by gender/age — schema allows it, implement later)
- any standard comments/interpretation text
- what their current printed report looks like (match or beat it)

This real data is what the schema is validated against.
