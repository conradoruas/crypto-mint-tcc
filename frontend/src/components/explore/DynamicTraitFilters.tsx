"use client";

import type {
  TraitField,
  TraitSchema,
  TraitFilterValue,
  TraitFilters,
  TraitOptionData,
} from "@/types/traits";

type Props = {
  schema: TraitSchema;
  optionData: Record<string, TraitOptionData[]>;
  traitFilters: TraitFilters;
  onSetTraitFilter: (key: string, value: TraitFilterValue | undefined) => void;
  onClearTraitFilters: () => void;
};

export function DynamicTraitFilters({
  schema,
  optionData,
  traitFilters,
  onSetTraitFilter,
  onClearTraitFilters,
}: Props) {
  const hasActive = Object.keys(traitFilters).length > 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-headline text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          Traits
        </h3>
        {hasActive && (
          <button
            onClick={onClearTraitFilters}
            className="text-[10px] text-primary hover:text-primary/70 uppercase tracking-widest transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-5">
        {schema.fields.map((field) => (
          <TraitFilterSection
            key={field.key}
            field={field}
            options={optionData[field.key] ?? []}
            value={traitFilters[field.key]}
            onChange={(v) => onSetTraitFilter(field.key, v)}
          />
        ))}
      </div>
    </section>
  );
}

function TraitFilterSection({
  field,
  options,
  value,
  onChange,
}: {
  field: TraitField;
  options: TraitOptionData[];
  value: TraitFilterValue | undefined;
  onChange: (v: TraitFilterValue | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-headline font-bold text-on-surface-variant/70 uppercase tracking-widest">
        {field.label}
      </h4>

      {field.type === "enum" && (
        <EnumFilter
          options={
            options.length > 0
              ? options
              : field.options.map((v) => ({ value: v, count: 0, frequency: 0 }))
          }
          selected={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      )}

      {field.type === "number" && (
        <NumberRangeFilter
          min={(field as { min?: number }).min}
          max={(field as { max?: number }).max}
          value={typeof value === "object" && !Array.isArray(value) ? (value as { min?: number; max?: number }) : {}}
          onChange={onChange}
        />
      )}

      {field.type === "boolean" && (
        <BooleanFilter
          value={typeof value === "boolean" ? value : undefined}
          onChange={onChange}
        />
      )}

      {(field.type === "string" || field.type === "date") && (
        <TextFilter
          value={Array.isArray(value) && value.length > 0 ? value[0] : ""}
          onChange={(v) => onChange(v ? [v] : undefined)}
        />
      )}
    </div>
  );
}

function EnumFilter({
  options,
  selected,
  onChange,
}: {
  options: TraitOptionData[];
  selected: string[];
  onChange: (v: TraitFilterValue | undefined) => void;
}) {
  const toggle = (val: string) => {
    const next = selected.includes(val)
      ? selected.filter((s) => s !== val)
      : [...selected, val];
    onChange(next.length > 0 ? next : undefined);
  };

  return (
    <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
      {options.slice(0, 64).map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <label
            key={opt.value}
            className="flex items-center justify-between gap-2 cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-primary"
                checked={active}
                onChange={() => toggle(opt.value)}
              />
              <span
                className={`text-xs transition-colors ${
                  active
                    ? "text-primary font-medium"
                    : "text-on-surface-variant group-hover:text-on-surface"
                }`}
              >
                {opt.value}
              </span>
            </div>
            {opt.count > 0 && (
              <span className="text-[10px] text-on-surface-variant/50 tabular-nums">
                {opt.count}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function NumberRangeFilter({
  min: fieldMin,
  max: fieldMax,
  value,
  onChange,
}: {
  min?: number;
  max?: number;
  value: { min?: number; max?: number };
  onChange: (v: TraitFilterValue | undefined) => void;
}) {
  const update = (key: "min" | "max", raw: string) => {
    const next = { ...value };
    if (raw === "") {
      delete next[key];
    } else {
      next[key] = Number(raw);
    }
    const empty = next.min === undefined && next.max === undefined;
    onChange(empty ? undefined : next);
  };

  const inputClass =
    "w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-2.5 py-1.5 rounded-sm text-xs focus:outline-none focus:border-primary transition-all";

  return (
    <div className="grid grid-cols-2 gap-2">
      <input
        type="number"
        className={inputClass}
        placeholder={fieldMin !== undefined ? `Min ${fieldMin}` : "Min"}
        value={value.min ?? ""}
        min={fieldMin}
        max={fieldMax}
        onChange={(e) => update("min", e.target.value)}
      />
      <input
        type="number"
        className={inputClass}
        placeholder={fieldMax !== undefined ? `Max ${fieldMax}` : "Max"}
        value={value.max ?? ""}
        min={fieldMin}
        max={fieldMax}
        onChange={(e) => update("max", e.target.value)}
      />
    </div>
  );
}

function BooleanFilter({
  value,
  onChange,
}: {
  value: boolean | undefined;
  onChange: (v: TraitFilterValue | undefined) => void;
}) {
  return (
    <div className="flex gap-2">
      {[true, false].map((b) => (
        <button
          key={String(b)}
          onClick={() => onChange(value === b ? undefined : b)}
          className={`px-3 py-1 text-xs rounded-full border transition-all ${
            value === b
              ? "bg-secondary-container text-on-secondary-container border-secondary/20"
              : "bg-surface-container text-on-surface-variant border-outline-variant/15 hover:border-outline"
          }`}
        >
          {b ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function TextFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      className="w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-2.5 py-1.5 rounded-sm text-xs focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/40"
      placeholder="Filter..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
