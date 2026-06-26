import { describe, it, expect } from "vitest";
import { templateSchema, type Template } from "@/lib/report-engine";
import { fbcTemplate } from "@/lib/report-engine/examples";
import { fromTemplate, toTemplate, NEW_BLOCKS, type BSection } from "@/app/(app)/templates/builderModel";

/** Serialise builder state the way the component does, then validate against the schema. */
function serialize(name: string, sections: BSection[]) {
  const json = toTemplate(name, 1, sections);
  return templateSchema.safeParse(json);
}

describe("builder serialisation", () => {
  it("round-trips the FBC template back to schema-valid JSON", () => {
    const sections = fromTemplate(fbcTemplate);
    const res = serialize(fbcTemplate.name, sections);
    expect(res.success).toBe(true);
  });

  it("preserves the FBC content through hydrate → serialise (ignoring version)", () => {
    const sections = fromTemplate(fbcTemplate);
    const out = toTemplate(fbcTemplate.name, 1, sections) as Template;
    expect(out).toEqual({ ...fbcTemplate, version: 1 });
  });

  it("omits empty optional row bounds rather than emitting blanks", () => {
    const sections: BSection[] = [
      {
        _id: "x",
        type: "results_table",
        title: "",
        rows: [
          { _id: "r", key: "hb", test: "Hb", unit: "", ref_low: "13", ref_high: "", critical_low: "", critical_high: "" },
        ],
      },
    ];
    const out = toTemplate("T", 1, sections) as Template;
    const row = (out.sections[0] as Extract<Template["sections"][number], { type: "results_table" }>).rows[0];
    expect(row).toEqual({ key: "hb", test: "Hb", ref_low: 13 }); // no unit / ref_high / criticals
  });

  it("emits a select field's options as an array and trims the title", () => {
    const sections: BSection[] = [
      { _id: "f", type: "field", key: "sex", label: "Sex", inputType: "select", options: " M \n F \n\n", required: true },
    ];
    const out = toTemplate("T", 1, sections) as Template;
    const field = out.sections[0] as Extract<Template["sections"][number], { type: "field" }>;
    expect(field.options).toEqual(["M", "F"]);
    expect(field.required).toBe(true);
    expect(serialize("T", sections).success).toBe(true);
  });

  it("produces a schema-valid template from a fresh block of every type", () => {
    const sections = [
      NEW_BLOCKS.patient_info(),
      { ...NEW_BLOCKS.field(), key: "note", label: "Note" } as BSection,
      { ...NEW_BLOCKS.textarea(), key: "comments", label: "Comments" } as BSection,
      { ...NEW_BLOCKS.static(), text: "Lab report" } as BSection,
      NEW_BLOCKS.signature(),
      {
        ...NEW_BLOCKS.results_table(),
        rows: [{ _id: "r", key: "hb", test: "Hb", unit: "g/dL", ref_low: "13", ref_high: "17", critical_low: "", critical_high: "" }],
      } as BSection,
    ];
    expect(serialize("Everything", sections).success).toBe(true);
  });
});
