"use client";

import { useMemo, useState, type ReactNode } from "react";
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
import type { Template } from "@/lib/report-engine";
import type { TemplateFormState } from "./actions";
import {
  BLOCK_ORDER,
  INPUT_TYPES,
  NEW_BLOCKS,
  PATIENT_FIELDS,
  emptyRow,
  fromTemplate,
  toTemplateJson,
  type BRow,
  type BSection,
  type BlockType,
  type InputType,
} from "./builderModel";

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const schemaJson = useMemo(
    () => toTemplateJson(name, initialTemplate.version, sections),
    [name, initialTemplate.version, sections],
  );

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
  const addSection = (type: BlockType) => setSections((prev) => [...prev, NEW_BLOCKS[type]()]);

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
