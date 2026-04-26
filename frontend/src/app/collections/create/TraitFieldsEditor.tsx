"use client";

import type { NftAttribute, TraitField, TraitSchema } from "@/types/traits";

type Props = {
  schema: TraitSchema;
  attributes: NftAttribute[];
  onChange: (attributes: NftAttribute[]) => void;
};

const inputClass =
  "w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-2.5 py-1.5 rounded-sm text-xs focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/40";

export function TraitFieldsEditor({ schema, attributes, onChange }: Props) {
  const getValue = (key: string): NftAttribute | undefined =>
    attributes.find((a) => a.trait_type === key);

  const setValue = (field: TraitField, value: string | number | boolean) => {
    const next = attributes.filter((a) => a.trait_type !== field.key);
    if (value !== "" && value !== undefined) {
      const attr: NftAttribute = {
        trait_type: field.key,
        value,
        ...(field.type === "number" && (field as { displayType?: string }).displayType
          ? { display_type: (field as { displayType?: string }).displayType }
          : {}),
        ...(field.type === "number" && (field as { max?: number }).max !== undefined
          ? { max_value: (field as { max?: number }).max }
          : {}),
      };
      next.push(attr);
    }
    onChange(next);
  };

  return (
    <div className="space-y-2 mt-3">
      {schema.fields.map((field) => {
        const current = getValue(field.key);
        return (
          <TraitInput
            key={field.key}
            field={field}
            value={current?.value}
            onSet={(v) => setValue(field, v)}
          />
        );
      })}
    </div>
  );
}

function TraitInput({
  field,
  value,
  onSet,
}: {
  field: TraitField;
  value: string | number | boolean | undefined;
  onSet: (v: string | number | boolean) => void;
}) {
  const label = (
    <span className="text-[9px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">
      {field.label}
      {field.required && <span className="text-error ml-0.5">*</span>}
    </span>
  );

  if (field.type === "enum") {
    const opts = (field as { options: string[] }).options ?? [];
    return (
      <div>
        {label}
        <select
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onSet(e.target.value)}
        >
          <option value="">— select —</option>
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "number") {
    const numField = field as { min?: number; max?: number };
    return (
      <div>
        {label}
        <input
          type="number"
          className={inputClass}
          placeholder={`${numField.min ?? ""}–${numField.max ?? ""}`}
          min={numField.min}
          max={numField.max}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onSet(e.target.value ? Number(e.target.value) : "")}
        />
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="accent-primary"
          checked={value === true}
          onChange={(e) => onSet(e.target.checked)}
        />
        <span className="text-[9px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">
          {field.label}
        </span>
      </label>
    );
  }

  // string / date fallback
  return (
    <div>
      {label}
      <input
        type={field.type === "date" ? "date" : "text"}
        className={inputClass}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onSet(e.target.value)}
        maxLength={(field as { maxLength?: number }).maxLength ?? 200}
      />
    </div>
  );
}
