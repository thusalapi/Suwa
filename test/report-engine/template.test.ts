import { describe, it, expect } from "vitest";
import { templateSchema, parseTemplate, resultRows, type Template } from "@/lib/report-engine/template";
import { fbcTemplate } from "@/lib/report-engine/examples";

describe("templateSchema", () => {
  it("accepts the FBC example template", () => {
    expect(templateSchema.safeParse(fbcTemplate).success).toBe(true);
    expect(() => parseTemplate(fbcTemplate)).not.toThrow();
  });

  it("requires at least one section", () => {
    expect(templateSchema.safeParse({ name: "X", version: 1, sections: [] }).success).toBe(false);
  });

  it("rejects a non-snake_case key", () => {
    const tpl = {
      name: "X",
      version: 1,
      sections: [{ type: "field", key: "BadKey", label: "L", inputType: "text" }],
    };
    expect(templateSchema.safeParse(tpl).success).toBe(false);
  });

  it("rejects duplicate field/textarea keys", () => {
    const tpl = {
      name: "X",
      version: 1,
      sections: [
        { type: "field", key: "dup", label: "A", inputType: "text" },
        { type: "textarea", key: "dup", label: "B" },
      ],
    };
    expect(templateSchema.safeParse(tpl).success).toBe(false);
  });

  it("rejects a key that collides with a reserved namespace", () => {
    const tpl = {
      name: "X",
      version: 1,
      sections: [{ type: "field", key: "results", label: "L", inputType: "text" }],
    };
    expect(templateSchema.safeParse(tpl).success).toBe(false);
  });

  it("rejects a select field without options", () => {
    const tpl = {
      name: "X",
      version: 1,
      sections: [{ type: "field", key: "sex", label: "Sex", inputType: "select" }],
    };
    expect(templateSchema.safeParse(tpl).success).toBe(false);
  });

  it("rejects a results row where ref_low > ref_high", () => {
    const tpl = {
      name: "X",
      version: 1,
      sections: [{ type: "results_table", rows: [{ key: "x", test: "X", ref_low: 10, ref_high: 5 }] }],
    };
    expect(templateSchema.safeParse(tpl).success).toBe(false);
  });

  it("rejects duplicate result-row keys", () => {
    const tpl = {
      name: "X",
      version: 1,
      sections: [
        {
          type: "results_table",
          rows: [
            { key: "x", test: "A" },
            { key: "x", test: "B" },
          ],
        },
      ],
    };
    expect(templateSchema.safeParse(tpl).success).toBe(false);
  });
});

describe("resultRows", () => {
  it("flattens every analyte row across results tables", () => {
    expect(resultRows(fbcTemplate).map((r) => r.key)).toEqual(["hb", "wbc", "plt"]);
  });

  it("returns an empty array when there are no results tables", () => {
    const tpl: Template = { name: "X", version: 1, sections: [{ type: "static", text: "hi" }] };
    expect(resultRows(tpl)).toEqual([]);
  });
});
