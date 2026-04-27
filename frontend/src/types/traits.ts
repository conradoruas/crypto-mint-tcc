export type TraitFieldType = "string" | "number" | "enum" | "boolean" | "date";

interface TraitFieldBase {
  key: string;
  label: string;
  required: boolean;
}

export interface TraitFieldString extends TraitFieldBase {
  type: "string";
  maxLength?: number;
}

export interface TraitFieldNumber extends TraitFieldBase {
  type: "number";
  min?: number;
  max?: number;
  integer?: boolean;
  displayType?: "number" | "boost_number" | "boost_percentage";
}

export interface TraitFieldEnum extends TraitFieldBase {
  type: "enum";
  options: string[];
}

export interface TraitFieldBoolean extends TraitFieldBase {
  type: "boolean";
}

export interface TraitFieldDate extends TraitFieldBase {
  type: "date";
}

export type TraitField =
  | TraitFieldString
  | TraitFieldNumber
  | TraitFieldEnum
  | TraitFieldBoolean
  | TraitFieldDate;

export interface TraitSchema {
  version: 1;
  fields: TraitField[];
}

// ─── Per-NFT attribute (OpenSea-compatible) ─────────────────────────────────

export interface NftAttribute {
  trait_type: string;
  value: string | number | boolean;
  display_type?: string;
  max_value?: number;
}

// ─── Per-collection trait option from the subgraph ─────────────────────────

export interface TraitOptionData {
  value: string;
  count: number;
  frequency: number;
}

export interface TraitDefinitionData {
  key: string;
  label: string;
  type: TraitFieldType;
  required: boolean;
  minValue?: string | null;
  maxValue?: string | null;
  options: TraitOptionData[];
}

// ─── Active trait filter values (Explore page) ──────────────────────────────

export type TraitFilterValue =
  | string[]                              // enum / string: selected options
  | { min?: number; max?: number }        // number range
  | boolean;                              // boolean toggle

export type TraitFilters = Record<string, TraitFilterValue>;
