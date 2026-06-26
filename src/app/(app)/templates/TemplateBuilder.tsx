"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";
import { Spinner } from "@/components/atoms/Spinner";
import { cn } from "@/lib/utils/cn";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { PAGE_CONTENT, type Position, type Template } from "@/lib/report-engine";
import type { TemplateFormState } from "./actions";
import {
  BLOCK_ORDER,
  INPUT_TYPES,
  NEW_BLOCKS,
  PATIENT_FIELDS,
  defaultPos,
  emptyRow,
  fromTemplate,
  toTemplateJson,
  withPositions,
  type BRow,
  type BSection,
  type BlockType,
  type InputType,
  type TemplateLayout,
} from "./builderModel";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── Small shared UI ─────────────────────────────────────────────────────────────────────────
const selectClass = cn(
  "h-9 rounded-md border border-border bg-white px-2 text-sm text-ink",
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
);

function FieldBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

// ── Results-table rows (their own sortable context) ──────────────────────────────────────────
function SortableRow({
  row,
  t,
  onChange,
  onRemove,
}: {
  row: BRow;
  t: (k: string) => string;
  onChange: (r: BRow) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row._id });
  const set = (patch: Partial<BRow>) => onChange({ ...row, ...patch });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface px-2 py-2",
        isDragging && "opacity-60",
      )}
    >
      <button
        type="button"
        className="cursor-grab self-center px-1 text-muted hover:text-ink"
        aria-label={t("templates.builder.dragBlock")}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <FieldBox label={t("templates.builder.row_test")}>
        <Input value={row.test} onChange={(e) => set({ test: e.target.value })} className="h-9 w-40" />
      </FieldBox>
      <FieldBox label={t("templates.builder.key")}>
        <Input value={row.key} onChange={(e) => set({ key: e.target.value })} className="h-9 w-28" />
      </FieldBox>
      <FieldBox label={t("templates.builder.row_unit")}>
        <Input value={row.unit} onChange={(e) => set({ unit: e.target.value })} className="h-9 w-20" />
      </FieldBox>
      <FieldBox label={t("templates.builder.row_refLow")}>
        <Input type="number" value={row.ref_low} onChange={(e) => set({ ref_low: e.target.value })} className="h-9 w-20" />
      </FieldBox>
      <FieldBox label={t("templates.builder.row_refHigh")}>
        <Input type="number" value={row.ref_high} onChange={(e) => set({ ref_high: e.target.value })} className="h-9 w-20" />
      </FieldBox>
      <FieldBox label={t("templates.builder.row_critLow")}>
        <Input type="number" value={row.critical_low} onChange={(e) => set({ critical_low: e.target.value })} className="h-9 w-20" />
      </FieldBox>
      <FieldBox label={t("templates.builder.row_critHigh")}>
        <Input type="number" value={row.critical_high} onChange={(e) => set({ critical_high: e.target.value })} className="h-9 w-20" />
      </FieldBox>
      <button type="button" onClick={onRemove} className="self-center px-1 text-sm text-danger hover:underline">
        {t("templates.builder.removeRow")}
      </button>
    </div>
  );
}

// ── Per-block editors ────────────────────────────────────────────────────────────────────────
function SectionEditor({
  section,
  t,
  onChange,
}: {
  section: BSection;
  t: (k: string) => string;
  onChange: (s: BSection) => void;
}) {
  const rowSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  switch (section.type) {
    case "patient_info":
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted">{t("templates.builder.patientFields")}</p>
          <div className="flex flex-wrap gap-3">
            {PATIENT_FIELDS.map((f) => (
              <label key={f} className="flex items-center gap-1.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={section.fields.includes(f)}
                  onChange={(e) =>
                    onChange({
                      ...section,
                      fields: e.target.checked ? [...section.fields, f] : section.fields.filter((x) => x !== f),
                    })
                  }
                />
                {t(`reports.pi_${f}`)}
              </label>
            ))}
          </div>
        </div>
      );

    case "static":
      return (
        <div className="space-y-2">
          <FieldBox label={t("templates.builder.staticText")}>
            <Input value={section.text} onChange={(e) => onChange({ ...section, text: e.target.value })} />
          </FieldBox>
          <label className="flex items-center gap-1.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={section.heading}
              onChange={(e) => onChange({ ...section, heading: e.target.checked })}
            />
            {t("templates.builder.heading")}
          </label>
        </div>
      );

    case "field":
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <FieldBox label={t("templates.builder.label")}>
              <Input value={section.label} onChange={(e) => onChange({ ...section, label: e.target.value })} className="h-9 w-48" />
            </FieldBox>
            <FieldBox label={t("templates.builder.key")}>
              <Input value={section.key} onChange={(e) => onChange({ ...section, key: e.target.value })} className="h-9 w-36" />
            </FieldBox>
            <FieldBox label={t("templates.builder.inputType")}>
              <select
                value={section.inputType}
                onChange={(e) => onChange({ ...section, inputType: e.target.value as InputType })}
                className={selectClass}
              >
                {INPUT_TYPES.map((it) => (
                  <option key={it} value={it}>
                    {t(`templates.builder.inputType_${it}`)}
                  </option>
                ))}
              </select>
            </FieldBox>
            <label className="flex items-center gap-1.5 self-end pb-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={section.required}
                onChange={(e) => onChange({ ...section, required: e.target.checked })}
              />
              {t("templates.builder.required")}
            </label>
          </div>
          {section.inputType === "select" ? (
            <FieldBox label={`${t("templates.builder.options")} — ${t("templates.builder.optionsHint")}`}>
              <textarea
                value={section.options}
                onChange={(e) => onChange({ ...section, options: e.target.value })}
                rows={3}
                className={cn(
                  "w-full max-w-md rounded-md border border-border bg-white px-2 py-1 text-sm text-ink",
                  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
                )}
              />
            </FieldBox>
          ) : null}
          <p className="text-xs text-muted">{t("templates.builder.keyHint")}</p>
        </div>
      );

    case "results_table": {
      const onRowsEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (over && active.id !== over.id) {
          const from = section.rows.findIndex((r) => r._id === active.id);
          const to = section.rows.findIndex((r) => r._id === over.id);
          onChange({ ...section, rows: arrayMove(section.rows, from, to) });
        }
      };
      return (
        <div className="space-y-2">
          <FieldBox label={t("templates.builder.title")}>
            <Input value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} className="h-9 w-64" />
          </FieldBox>
          <DndContext sensors={rowSensors} collisionDetection={closestCenter} onDragEnd={onRowsEnd}>
            <SortableContext items={section.rows.map((r) => r._id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {section.rows.map((r) => (
                  <SortableRow
                    key={r._id}
                    row={r}
                    t={t}
                    onChange={(nr) => onChange({ ...section, rows: section.rows.map((x) => (x._id === nr._id ? nr : x)) })}
                    onRemove={() => onChange({ ...section, rows: section.rows.filter((x) => x._id !== r._id) })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              onChange({ ...section, rows: [...section.rows, emptyRow()] })
            }
          >
            {t("templates.builder.addRow")}
          </Button>
        </div>
      );
    }

    case "textarea":
      return (
        <div className="flex flex-wrap gap-2">
          <FieldBox label={t("templates.builder.label")}>
            <Input value={section.label} onChange={(e) => onChange({ ...section, label: e.target.value })} className="h-9 w-48" />
          </FieldBox>
          <FieldBox label={t("templates.builder.key")}>
            <Input value={section.key} onChange={(e) => onChange({ ...section, key: e.target.value })} className="h-9 w-36" />
          </FieldBox>
        </div>
      );

    case "signature":
      return (
        <FieldBox label={t("templates.builder.signatureLabel")}>
          <Input value={section.label} onChange={(e) => onChange({ ...section, label: e.target.value })} className="h-9 w-64" />
        </FieldBox>
      );
  }
}

// ── Sortable section card ────────────────────────────────────────────────────────────────────
function SortableSection({
  section,
  t,
  onChange,
  onRemove,
}: {
  section: BSection;
  t: (k: string) => string;
  onChange: (s: BSection) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section._id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-lg border border-border bg-surface-raised p-3", isDragging && "opacity-60 shadow-lg")}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab text-muted hover:text-ink"
            aria-label={t("templates.builder.dragBlock")}
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
          <span className="text-sm font-semibold text-ink">{t(`templates.builder.block_${section.type}`)}</span>
        </div>
        <button type="button" onClick={onRemove} className="text-sm text-danger hover:underline">
          {t("templates.builder.removeBlock")}
        </button>
      </div>
      <SectionEditor section={section} t={t} onChange={onChange} />
    </div>
  );
}

function SubmitButton({ label, pendingLabel, disabled }: { label: string; pendingLabel: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <Spinner label={pendingLabel} /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

// ── Canvas (free-form) layout ────────────────────────────────────────────────────────────────
function blockSummary(s: BSection, t: (k: string) => string): string {
  switch (s.type) {
    case "patient_info":
      return s.fields.map((f) => t(`reports.pi_${f}`)).join(", ");
    case "static":
      return s.text || "—";
    case "field":
    case "textarea":
      return s.label || s.key || "—";
    case "results_table":
      return s.title || `${s.rows.length} rows`;
    case "signature":
      return s.label || "—";
  }
}

/** One positioned card on the canvas: drag to move, drag the right edge to resize width. */
function CanvasCard({
  section,
  t,
  selected,
  canvasRef,
  onSelect,
  onPos,
  onRemove,
}: {
  section: BSection;
  t: (k: string) => string;
  selected: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onPos: (pos: Position) => void;
  onRemove: () => void;
}) {
  const pos = section.pos ?? defaultPos(0);

  const startMove = (e: ReactPointerEvent) => {
    e.preventDefault();
    onSelect();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const orig = { ...pos };
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - sx) / rect.width) * 100;
      const dy = ((ev.clientY - sy) / rect.height) * 100;
      onPos({
        x: clamp(orig.x + dx, 0, 100 - orig.w),
        y: clamp(orig.y + dy, 0, 99),
        w: orig.w,
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX;
    const orig = { ...pos };
    const move = (ev: PointerEvent) => {
      const dw = ((ev.clientX - sx) / rect.width) * 100;
      onPos({ ...orig, w: clamp(orig.w + dw, 10, 100 - orig.x) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      onPointerDown={startMove}
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.w}%` }}
      className={cn(
        "absolute cursor-move touch-none select-none rounded border bg-white shadow-sm",
        selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50",
      )}
    >
      <div className="flex items-center justify-between gap-1 border-b border-border bg-surface px-2 py-1">
        <span className="truncate text-[11px] font-semibold text-ink">{t(`templates.builder.block_${section.type}`)}</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="shrink-0 text-xs text-danger hover:underline"
          aria-label={t("templates.builder.removeBlock")}
        >
          ✕
        </button>
      </div>
      <p className="truncate px-2 py-1.5 text-[11px] text-muted">{blockSummary(section, t)}</p>
      <span
        onPointerDown={startResize}
        className="absolute -right-1 top-1/2 h-4 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-primary/60"
        aria-hidden
      />
    </div>
  );
}

function TemplateCanvas({
  sections,
  t,
  selectedId,
  onSelect,
  onPos,
  onRemove,
}: {
  sections: BSection[];
  t: (k: string) => string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPos: (id: string, pos: Position) => void;
  onRemove: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  return (
    <div className="flex justify-center rounded-lg border border-border bg-surface p-4">
      <div
        ref={canvasRef}
        className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded bg-white shadow-inner ring-1 ring-border"
        style={{ aspectRatio: `${PAGE_CONTENT.width} / ${PAGE_CONTENT.height}` }}
      >
        {/* Header / footer chrome zones (fixed on the printed report) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[7%] items-center border-b border-dashed border-border px-2 text-[10px] text-muted">
          {t("templates.builder.canvasHeaderZone")}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[4%] items-center border-t border-dashed border-border px-2 text-[10px] text-muted">
          {t("templates.builder.canvasFooterZone")}
        </div>
        {sections.map((s) => (
          <CanvasCard
            key={s._id}
            section={s}
            t={t}
            selected={selectedId === s._id}
            canvasRef={canvasRef}
            onSelect={() => onSelect(s._id)}
            onPos={(pos) => onPos(s._id, pos)}
            onRemove={() => onRemove(s._id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── The builder ──────────────────────────────────────────────────────────────────────────────
export interface TemplateBuilderProps {
  locale: Locale;
  action: (prev: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  templateId?: string;
  initialTemplate: Template;
  submitLabel: string;
}

export function TemplateBuilder({ locale, action, templateId, initialTemplate, submitLabel }: TemplateBuilderProps) {
  const t = getT(locale);
  const [state, formAction] = useActionState<TemplateFormState, FormData>(action, {});
  const [name, setName] = useState(initialTemplate.name);
  const [sections, setSections] = useState<BSection[]>(() => fromTemplate(initialTemplate));
  const [layout, setLayout] = useState<TemplateLayout>(initialTemplate.layout === "canvas" ? "canvas" : "flow");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const schemaJson = useMemo(
    () => toTemplateJson(name, initialTemplate.version, sections, layout),
    [name, initialTemplate.version, sections, layout],
  );

  /** Switching to canvas assigns a position to any block that lacks one. */
  const switchLayout = (next: TemplateLayout) => {
    if (next === "canvas") setSections((prev) => withPositions(prev));
    setLayout(next);
  };
  const selected = sections.find((s) => s._id === selectedId) ?? null;

  const clientError =
    name.trim() === "" ? "templates.builder.emptyName" : sections.length === 0 ? "templates.builder.noSections" : null;

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const from = sections.findIndex((s) => s._id === active.id);
      const to = sections.findIndex((s) => s._id === over.id);
      setSections((prev) => arrayMove(prev, from, to));
    }
  };

  const updateSection = (s: BSection) => setSections((prev) => prev.map((x) => (x._id === s._id ? s : x)));
  const removeSection = (id: string) => setSections((prev) => prev.filter((x) => x._id !== id));
  const setPos = (id: string, pos: Position) =>
    setSections((prev) => prev.map((x) => (x._id === id ? { ...x, pos } : x)));
  const addSection = (type: BlockType) => {
    const base = NEW_BLOCKS[type]();
    const block: BSection = layout === "canvas" ? { ...base, pos: defaultPos(sections.length) } : base;
    setSections((prev) => [...prev, block]);
    setSelectedId(block._id);
  };

  return (
    <form action={formAction} className="space-y-5">
      {templateId ? <input type="hidden" name="id" value={templateId} /> : null}
      {/* The whole template, serialised — this is what the Server Action validates + stores. */}
      <input type="hidden" name="schema" value={schemaJson} />

      <div className="space-y-1.5">
        <Label htmlFor="tpl-name">{t("templates.builder.templateName")}</Label>
        <Input
          id="tpl-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("templates.builder.templateNamePlaceholder")}
          className="max-w-md"
        />
      </div>

      {/* Layout mode */}
      <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1 text-sm w-fit">
        {(["flow", "canvas"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => switchLayout(mode)}
            className={cn(
              "rounded px-3 py-1 font-medium",
              layout === mode ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {t(`templates.builder.layout_${mode}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted">{t("templates.builder.addBlock")}:</span>
        {BLOCK_ORDER.map((type) => (
          <Button key={type} type="button" variant="secondary" size="sm" onClick={() => addSection(type)}>
            + {t(`templates.builder.block_${type}`)}
          </Button>
        ))}
      </div>

      {sections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {t("templates.builder.empty")}
        </div>
      ) : layout === "canvas" ? (
        <div className="space-y-4">
          <p className="text-xs text-muted">{t("templates.builder.canvasHint")}</p>
          <TemplateCanvas
            sections={sections}
            t={t}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPos={setPos}
            onRemove={(id) => {
              removeSection(id);
              setSelectedId((cur) => (cur === id ? null : cur));
            }}
          />
          {selected ? (
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <p className="mb-2 text-sm font-semibold text-ink">
                {t(`templates.builder.block_${selected.type}`)}
              </p>
              <SectionEditor section={selected} t={t} onChange={updateSection} />
            </div>
          ) : (
            <p className="text-sm text-muted">{t("templates.builder.canvasSelectHint")}</p>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s) => s._id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sections.map((s) => (
                <SortableSection
                  key={s._id}
                  section={s}
                  t={t}
                  onChange={updateSection}
                  onRemove={() => removeSection(s._id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {state.error ? (
        <div role="alert" className="space-y-1 rounded-md border border-danger/30 bg-danger/10 p-3">
          <p className="text-sm font-medium text-danger">{t(state.error)}</p>
          {state.detail ? <p className="font-mono text-xs text-danger">{state.detail}</p> : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton label={submitLabel} pendingLabel={t("common.saving")} disabled={!!clientError} />
        {clientError ? <p className="text-sm text-muted">{t(clientError)}</p> : null}
      </div>
    </form>
  );
}
