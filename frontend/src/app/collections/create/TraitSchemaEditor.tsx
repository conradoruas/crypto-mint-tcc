"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Tags } from "lucide-react";
import type { TraitField, TraitSchema } from "@/types/traits";

type Props = {
  schema: TraitSchema | undefined;
  onChange: (schema: TraitSchema | undefined) => void;
};

const FIELD_TYPES: { value: TraitField["type"]; label: string }[] = [
  { value: "enum", label: "Options (enum)" },
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
];

const inputClass =
  "w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/40";

const labelClass =
  "block text-[10px] font-headline font-bold mb-1.5 uppercase tracking-widest text-on-surface-variant";

function newField(): TraitField {
  return { key: "", label: "", type: "enum", required: false, options: [] };
}

export function TraitSchemaEditor({ schema, onChange }: Props) {
  const [open, setOpen] = useState(true);

  const fields = schema?.fields ?? [];

  const updateFields = useCallback(
    (next: TraitField[]) => {
      if (next.length === 0) {
        onChange(undefined);
      } else {
        onChange({ version: 1, fields: next });
      }
    },
    [onChange],
  );

  const addField = () => updateFields([...fields, newField()]);

  const removeField = (i: number) =>
    updateFields(fields.filter((_, idx) => idx !== i));

  const updateField = (i: number, patch: Partial<TraitField>) =>
    updateFields(
      fields.map((f, idx) => (idx !== i ? f : ({ ...f, ...patch } as TraitField))),
    );

  const updateOptions = (i: number, raw: string) => {
    const options = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateField(i, { options } as Partial<TraitField>);
  };

  return (
    <div className="border border-outline-variant/10 rounded-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-container/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Tags size={16} className="text-primary" />
          <span className="text-sm font-headline font-bold uppercase tracking-wide">
            Trait Schema
            {fields.length > 0 && (
              <span className="ml-2 text-primary text-xs">
                ({fields.length} field{fields.length !== 1 ? "s" : ""})
              </span>
            )}
          </span>
          <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
            optional · V2 factory only
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-on-surface-variant" />
        ) : (
          <ChevronDown size={16} className="text-on-surface-variant" />
        )}
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-outline-variant/10">
          <p className="text-xs text-on-surface-variant/70 pt-4">
            Define the trait fields collectors see. Each NFT in this collection
            can then be assigned values for these traits.
          </p>

          {fields.map((field, i) => (
            <FieldRow
              key={i}
              field={field}
              index={i}
              onUpdate={(patch) => updateField(i, patch)}
              onUpdateOptions={(raw) => updateOptions(i, raw)}
              onRemove={() => removeField(i)}
            />
          ))}

          {fields.length < 32 && (
            <button
              type="button"
              onClick={addField}
              className="flex items-center gap-2 text-xs font-headline font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={14} />
              Add Trait Field
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field,
  index,
  onUpdate,
  onUpdateOptions,
  onRemove,
}: {
  field: TraitField;
  index: number;
  onUpdate: (patch: Partial<TraitField>) => void;
  onUpdateOptions: (raw: string) => void;
  onRemove: () => void;
}) {
  const optionsRaw =
    field.type === "enum" && (field as { options?: string[] }).options
      ? (field as { options: string[] }).options.join(", ")
      : "";

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 p-4 rounded-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">
          Field {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-on-surface-variant/40 hover:text-error transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Key *</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. class"
            value={field.key}
            onChange={(e) => onUpdate({ key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
            maxLength={64}
          />
        </div>
        <div>
          <label className={labelClass}>Label *</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Class"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            maxLength={64}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Type *</label>
          <select
            className={inputClass}
            value={field.type}
            onChange={(e) =>
              onUpdate({ type: e.target.value as TraitField["type"] })
            }
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-on-surface-variant">
            <input
              type="checkbox"
              className="accent-primary"
              checked={field.required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
            />
            Required
          </label>
        </div>
      </div>

      {field.type === "enum" && (
        <div>
          <label className={labelClass}>Options (comma-separated) *</label>
          <input
            type="text"
            className={inputClass}
            placeholder="Mage, Warrior, Rogue"
            value={optionsRaw}
            onChange={(e) => onUpdateOptions(e.target.value)}
          />
        </div>
      )}

      {field.type === "number" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Min</label>
            <input
              type="number"
              className={inputClass}
              value={(field as { min?: number }).min ?? ""}
              onChange={(e) =>
                onUpdate({ min: e.target.value ? Number(e.target.value) : undefined } as Partial<TraitField>)
              }
            />
          </div>
          <div>
            <label className={labelClass}>Max</label>
            <input
              type="number"
              className={inputClass}
              value={(field as { max?: number }).max ?? ""}
              onChange={(e) =>
                onUpdate({ max: e.target.value ? Number(e.target.value) : undefined } as Partial<TraitField>)
              }
            />
          </div>
        </div>
      )}

      {field.type === "string" && (
        <div>
          <label className={labelClass}>Max length</label>
          <input
            type="number"
            className={inputClass}
            placeholder="200"
            value={(field as { maxLength?: number }).maxLength ?? ""}
            onChange={(e) =>
              onUpdate({ maxLength: e.target.value ? Number(e.target.value) : undefined } as Partial<TraitField>)
            }
          />
        </div>
      )}
    </div>
  );
}
