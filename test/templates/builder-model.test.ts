import { describe, it, expect } from "vitest";
import { templateSchema, type Template } from "@/lib/report-engine";
import { fbcTemplate, fastingBloodSugarTemplate, bloodGroupingTemplate } from "@/lib/report-engine/examples";
import { fromTemplate, toTemplate, withPositions, NEW_BLOCKS, type BSection } from "@/app/(app)/templates/builderModel";

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

  it("preserves the house-style templates through hydrate → serialise (builder safety)", () => {
    // The advanced fields (list style, dual unit, qualitative, signature subtitle, manual
    // patient fields) must survive an edit-save in the visual builder, not get dropped.
    for (const tpl of [fastingBloodSugarTemplate, bloodGroupingTemplate]) {
      const out = toTemplate(tpl.name, 1, fromTemplate(tpl)) as Template;
      expect(out).toEqual({ ...tpl, version: 1 });
      expect(templateSchema.safeParse(out).success).toBe(true);
    }
  });

  it("omits empty optional row bounds rather than emitting blanks", () => {
    const sections: BSection[] = [
      {
        _id: "x",
        type: "results_table",
        title: "",
        rows: [
          {
            _id: "r",
            key: "hb",
            test: "Hb",
            unit: "",
            ref_low: "13",
            ref_high: "",
            critical_low: "",
            critical_high: "",
          },
        ],
      },
    ];
    const out = toTemplate("T", 1, sections) as Template;
    const row = (out.sections[0] as Extract<Template["sections"][number], { type: "results_table" }>).rows[0];
    expect(row).toEqual({ key: "hb", test: "Hb", ref_low: 13 }); // no unit / ref_high / criticals
  });

  it("emits a select field's options as an array and trims the title", () => {
    const sections: BSection[] = [
      {
        _id: "f",
        type: "field",
        key: "sex",
        label: "Sex",
        inputType: "select",
        options: " M \n F \n\n",
        required: true,
      },
    ];
    const out = toTemplate("T", 1, sections) as Template;
    const field = out.sections[0] as Extract<Template["sections"][number], { type: "field" }>;
    expect(field.options).toEqual(["M", "F"]);
    expect(field.required).toBe(true);
    expect(serialize("T", sections).success).toBe(true);
  });

  it("emits layout + per-block pos in canvas mode and stays schema-valid", () => {
    const sections: BSection[] = [
      { _id: "a", type: "signature", label: "Verified by", pos: { x: 10, y: 80, w: 40 } },
      { _id: "b", type: "static", text: "Lab report", heading: true }, // no pos → defaulted
    ];
    const out = toTemplate("Canvas T", 1, sections, "canvas") as Template;
    expect(out.layout).toBe("canvas");
    expect(out.sections[0].pos).toEqual({ x: 10, y: 80, w: 40 });
    expect(out.sections[1].pos).toBeDefined(); // withPositions filled it in
    expect(templateSchema.safeParse(out).success).toBe(true);
  });

  it("does not emit layout/pos in flow mode", () => {
    const sections: BSection[] = [{ _id: "a", type: "signature", label: "Verified by", pos: { x: 5, y: 5, w: 30 } }];
    const out = toTemplate("Flow T", 1, sections, "flow") as Template;
    expect(out.layout).toBeUndefined();
    expect(out.sections[0].pos).toBeUndefined();
  });

  it("round-trips canvas positions through hydrate → serialise", () => {
    const tpl: Template = {
      name: "C",
      version: 1,
      layout: "canvas",
      sections: [{ type: "signature", label: "Sig", pos: { x: 12, y: 70, w: 50 } }],
    };
    const out = toTemplate("C", 1, fromTemplate(tpl), "canvas") as Template;
    expect(out.sections[0].pos).toEqual({ x: 12, y: 70, w: 50 });
  });

  it("withPositions assigns a position only to blocks that lack one", () => {
    const positioned = withPositions([
      { _id: "a", type: "signature", label: "S", pos: { x: 1, y: 2, w: 3 } },
      { _id: "b", type: "signature", label: "S2" },
    ]);
    expect(positioned[0].pos).toEqual({ x: 1, y: 2, w: 3 });
    expect(positioned[1].pos).toBeDefined();
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
        rows: [
          {
            _id: "r",
            key: "hb",
            test: "Hb",
            unit: "g/dL",
            ref_low: "13",
            ref_high: "17",
            critical_low: "",
            critical_high: "",
          },
        ],
      } as BSection,
    ];
    expect(serialize("Everything", sections).success).toBe(true);
  });
});
