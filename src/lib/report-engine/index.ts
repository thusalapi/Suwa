/**
 * Report engine — the product differentiator. One JSON template schema drives a data-entry
 * form, a branded PDF, and a stored JSON record. This barrel exposes the schema/types,
 * reference-range flagging, and the filled-data validators. See docs/report-engine.md.
 *
 * Pure + dependency-free (Zod only) so it's shared by Server Actions, the form renderer, and
 * the PDF renderer alike — no DB or React imports here.
 */
export * from "./template";
export * from "./flag";
export * from "./report-data";
