export type SchemaVersion = 'v0.2.0';

export type RecordTypeKey = string;

export type FieldKey = string;

export type EnumValueKey = string;

export type StructTypeKey = string;

export type RecordTypeCategoryKey = string;

export type StateKey = string;

export type StageKey = string;

export type FieldType =
  | 'bool'
  | 'int'
  | 'float'
  | 'text'
  | 'rich_text'
  | 'reference'
  | 'typed_reference'
  | 'enum'
  | 'date'
  | 'timestamp'
  | 'struct'
  | 'permission'
  | 'record_type_privilege'
  | 'field_privilege'
  | 'conditional_privilege'
  | 'participation';

export type ReferenceType = 'child' | 'parent';

export type FieldConditionComparator = 'eq' | 'ne';

export type FieldConditionEffect = 'require' | 'show';

export type RecordTypeScope =
  | 'metadata_is_system_scoped'
  | 'data_is_system_scoped';

export interface CollectionData {
  min_length?: number;
  max_length?: number;
}

export interface IntData {
  min?: number;
  max?: number;
}

export interface FloatData {
  min?: number;
  max?: number;
}

export interface TextData {
  min_length?: number;
  max_length?: number;
}

export interface EnumValue {
  /** The enum value as it actually occurs in the json data. */
  key: EnumValueKey;
  name?: string;
  description?: string;
  /** Deprecated values may still occur in the data, but should not be used in new data. */
  is_deprecated?: boolean;
}

export interface EnumData {
  values: EnumValue[];
}

export interface ReferenceDetail {
  /** The field in the target record type by which it is referenced. Assumed to be the primary key if not set. */
  by_field?: FieldKey;
}

export interface ReferenceData {
  refers_to: Record<RecordTypeKey, ReferenceDetail>;
  /** A 'parent' reference refers to a record that has special ownership over the child. */
  reference_type?: ReferenceType;
}

export interface TypedReferenceData {
  refers_to: Record<RecordTypeKey, ReferenceDetail>;
  /** A 'parent' reference refers to a record that has special ownership over the child. */
  reference_type?: ReferenceType;
}

export interface StructData {
  key?: StructTypeKey;
}

export interface ParticipationData {
  refers_to: Record<RecordTypeKey, ReferenceDetail>;
}

export interface PermissionData {
  member_id?: ReferenceData;
  role?: EnumData;
}

export interface ConditionalPrivilegeData {
  /** Record types or record type categories that can be targeted. */
  type_keys: RecordTypeKey[];
}

export interface FieldPrivilegeData {
  /** Record types or record type categories that can be targeted. */
  type_keys: RecordTypeKey[];
}

export interface RecordTypePrivilegeData {
  /** Record types or record type categories that can be targeted. */
  type_keys: RecordTypeKey[];
}

export interface TargetTypeKeyData {
  /** Record types or record type categories that can be targeted. */
  type_keys: RecordTypeKey[];
}

/** Currently empty, reserved for future use. */
export interface FieldReferenceData {
  [key: string]: never;
}

/** Field definition; `type` selects which type-specific data property applies. */
export interface Field {
  type: FieldType;
  name?: string;
  description?: string;
  /** Required in the domain model of the external system. */
  is_required?: boolean;
  /** Can't be set on create/update; filled in by some process in the system. */
  is_read_only?: boolean | null;
  is_write_only?: boolean | null;
  /** Can be used for searching, sorting or filtering. */
  is_indexed?: boolean | null;
  /** Can be used to uniquely look up a record. */
  is_identifier?: boolean | null;
  default_value?: boolean | number | string;
  /** If set, the field is a collection of the given type. */
  collection?: CollectionData;

  // Type-specific data
  int?: IntData;
  float?: FloatData;
  text?: TextData;
  enum?: EnumData | null;
  reference?: ReferenceData;
  typed_reference?: TypedReferenceData;
  struct?: StructData;
  permission?: PermissionData;
  type_key?: TargetTypeKeyData;
  field_reference?: FieldReferenceData;
  record_type_privilege?: RecordTypePrivilegeData;
  field_privilege?: FieldPrivilegeData;
  conditional_privilege?: ConditionalPrivilegeData;
  participation?: ParticipationData;
}

/** When the controlling field's value matches `value` (per `comparator`), `effect` is applied to `affected_fields`. */
export interface FieldCondition {
  value: unknown;
  comparator: FieldConditionComparator;
  affected_fields: FieldKey[];
  effect: FieldConditionEffect;
}

export type FieldConditions = FieldCondition[];

export interface CustomLinkNames {
  forward_name: string;
  backward_name: string;
}

export interface CustomLinkData {
  /** The field that defines the link types in the system. */
  link_type_field: FieldKey;
  link_direction_names: Record<string, CustomLinkNames> | null;
}

export interface CustomStage {
  /** Must match a key in the diagram's 'states' map or be a default: 'open', 'in_progress', 'closed'. */
  state?: StateKey;
  /** Stage names this stage can transition to. */
  transitions_to?: StageKey[];
}

export interface CustomState {
  name: string;
  is_end_state?: boolean;
  /** Sort order. */
  ordinal?: number;
}

export interface StageDiagram {
  /** The field that represents the stage in the external system. */
  controlling_field: FieldKey;
  /** Stage keys must match the enum values in the controlling field. */
  stages: Record<StageKey, CustomStage>;
  /** The stage the parent record type starts in when created. */
  starting_stage?: StageKey;
  states?: Record<StateKey, CustomState>;
  /** No explicit transitions; create as an 'all-to-all' diagram. */
  all_transitions_allowed?: boolean;
}

export interface RecordTypeCategory {
  name?: string;
  /** Whether a record can move between record types of this category while preserving its identity. */
  are_record_type_conversions_possible?: boolean;
}

export interface Attachments {
  is_extractable?: boolean;
  /** Whether the connector supports creating attachments in the external system. */
  is_loadable?: boolean;
}

export interface RecordType {
  fields: Record<FieldKey, Field>;
  name?: string;
  description?: string;
  category?: RecordTypeCategoryKey;
  /** Whether the connector supports creating this record type in the external system. */
  is_loadable?: boolean;
  /** Whether the record type sends the complete system state in every sync. */
  is_snapshot?: boolean;
  /** No ID field; primarily used for authorization policies. */
  no_identifier?: boolean;
  scope?: RecordTypeScope;
  conditions?: Record<FieldKey, FieldConditions>;
  stage_diagram?: StageDiagram;
  link_naming_data?: CustomLinkData;
  attachments?: Attachments;
}

/** Reusable field structure. */
export interface StructType {
  fields: Record<FieldKey, Field>;
  name?: string;
}

/** Describes the logical structure of an external system. */
export interface ExternalDomainMetadata {
  record_types: Record<RecordTypeKey, RecordType>;
  record_type_categories?: Record<RecordTypeCategoryKey, RecordTypeCategory>;
  struct_types?: Record<StructTypeKey, StructType>;
  /** Version of the metadata format itself. */
  schema_version?: SchemaVersion;
}
