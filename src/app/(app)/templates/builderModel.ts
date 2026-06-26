/**
 * Pure model + (de)serialisation for the drag-and-drop template builder. Kept separate from the
 * React component (no "use client") so the serialisation — the contract that must always emit
 * schema-valid template JSON — is unit-testable. The Server Action re-validates authoritatively.
 */
import type { Position, Template } from "@/lib/report-engine";

export type TemplateLayout = "flow" | "canvas";

export const PATIENT_FIELDS = ["name", "age", "gender", "ref_doctor"] as const;
export type PatientField = (typeof PATIENT_FIELDS)[number];

export const INPUT_TYPES = ["text", "number", "date", "select"] as const;
export type InputType = (typeof INPUT_TYPES)[number];

/** Range fields are kept as strings while editing so an empty input means "omit the bound". */
export interface BRow {
  _id: string;
  key: string;
  test: string;
  unit: string;
  ref_low: string;
  ref_high: string;
  critical_low: string;
  critical_high: string;
}

type BSectionBase =
  | { _id: string; type: "patient_info"; fields: PatientField[] }
  | { _id: string; type: "static"; text: string; heading: boolean }
  | { _id: string; type: "field"; key: string; label: string; inputType: InputType; options: string; required: boolean }
  | { _id: string; type: "results_table"; title: string; rows: BRow[] }
  | { _id: string; type: "textarea"; key: string; label: string }
  | { _id: string; type: "signature"; label: string };

/** Each block also carries an optional free-form position (percent x/y/w) for canvas layout. */
export type BSection = BSectionBase & { pos?: Position };

export type BlockType = BSectionBase["type"];

export const BLOCK_ORDER: BlockType[] = ["patient_info", "results_table", "field", "textarea", "static", "signature"];

/** Short non-cryptographic id, just for stable dnd/React keys within the editor session. */
export const uid = (): string => Math.random().toString(36).slice(2, 10);

export const NEW_BLOCKS: Record<BlockType, () => BSection> = {
  patient_info: () => ({ _id: uid(), type: "patient_info", fields: ["name", "age", "gender"] }),
  results_table: () => ({ _id: uid(), type: "results_table", title: "", rows: [emptyRow()] }),
  field: () => ({ _id: uid(), type: "field", key: "", label: "", inputType: "text", options: "", required: false }),
  textarea: () => ({ _id: uid(), type: "textarea", key: "", label: "" }),
  static: () => ({ _id: uid(), type: "static", text: "", heading: false }),
  signature: () => ({ _id: uid(), type: "signature", label: "Verified by" }),
};

export function emptyRow(): BRow {
  return { _id: uid(), key: "", test: "", unit: "", ref_low: "", ref_high: "", critical_low: "", critical_high: "" };
}

/** Hydrate builder state from a stored/starter template (carrying any saved positions). */
export function fromTemplate(tpl: Template): BSection[] {
  return tpl.sections.map((s): BSection => {
    const pos = s.pos;
    switch (s.type) {
      case "patient_info":
        return { _id: uid(), type: "patient_info", fields: s.fields as PatientField[], pos };
      case "static":
        return { _id: uid(), type: "static", text: s.text, heading: !!s.heading, pos };
      case "field":
        return {
          _id: uid(),
          type: "field",
          key: s.key,
          label: s.label,
          inputType: s.inputType,
          options: (s.options ?? []).join("\n"),
          required: !!s.required,
          pos,
        };
      case "results_table":
        return {
          _id: uid(),
          type: "results_table",
          title: s.title ?? "",
          rows: s.rows.map((r) => ({
            _id: uid(),
            key: r.key,
            test: r.test,
            unit: r.unit ?? "",
            ref_low: r.ref_low?.toString() ?? "",
            ref_high: r.ref_high?.toString() ?? "",
            critical_low: r.critical_low?.toString() ?? "",
            critical_high: r.critical_high?.toString() ?? "",
          })),
          pos,
        };
      case "textarea":
        return { _id: uid(), type: "textarea", key: s.key, label: s.label, pos };
      case "signature":
        return { _id: uid(), type: "signature", label: s.label, pos };
    }
  });
}

/** A cascading default position for a block that doesn't have one yet (percent units). */
export function defaultPos(index: number): Position {
  return { x: 4, y: Math.min(14 + index * 12, 88), w: 92 };
}

/** Ensure every block has a position — used when switching a template into canvas layout. */
export function withPositions(sections: BSection[]): BSection[] {
  return sections.map((s, i) => (s.pos ? s : { ...s, pos: defaultPos(i) }));
}

const numField = (v: string, key: string): Record<string, number> => {
  const t = v.trim();
  if (t === "" || Number.isNaN(Number(t))) return {};
  return { [key]: Number(t) };
};

/** Serialise builder state into the plain template object the schema validates. */
export function toTemplate(name: string, version: number, sections: BSection[], layout: TemplateLayout = "flow"): unknown {
  // In canvas layout, persist a position for every block so the PDF lays them out exactly.
  const src = layout === "canvas" ? withPositions(sections) : sections;
  const withPos = (obj: Record<string, unknown>, s: BSection) =>
    layout === "canvas" && s.pos ? { ...obj, pos: s.pos } : obj;

  return {
    name: name.trim(),
    version: version || 1,
    ...(layout === "canvas" ? { layout } : {}),
    sections: src.map((s) => {
      switch (s.type) {
        case "patient_info":
          return withPos({ type: "patient_info", fields: s.fields }, s);
        case "static":
          return withPos({ type: "static", text: s.text, ...(s.heading ? { heading: true } : {}) }, s);
        case "field": {
          const base: Record<string, unknown> = { type: "field", key: s.key.trim(), label: s.label, inputType: s.inputType };
          if (s.inputType === "select") base.options = s.options.split("\n").map((o) => o.trim()).filter(Boolean);
          if (s.required) base.required = true;
          return withPos(base, s);
        }
        case "results_table":
          return withPos(
            {
              type: "results_table",
              ...(s.title.trim() ? { title: s.title.trim() } : {}),
              rows: s.rows.map((r) => ({
                key: r.key.trim(),
                test: r.test,
                ...(r.unit.trim() ? { unit: r.unit.trim() } : {}),
                ...numField(r.ref_low, "ref_low"),
                ...numField(r.ref_high, "ref_high"),
                ...numField(r.critical_low, "critical_low"),
                ...numField(r.critical_high, "critical_high"),
              })),
            },
            s,
          );
        case "textarea":
          return withPos({ type: "textarea", key: s.key.trim(), label: s.label }, s);
        case "signature":
          return withPos({ type: "signature", label: s.label }, s);
      }
    }),
  };
}

export const toTemplateJson = (name: string, version: number, sections: BSection[], layout: TemplateLayout = "flow"): string =>
  JSON.stringify(toTemplate(name, version, sections, layout));
