/**
 * Schema version for the external domain metadata format.
 */
export type SchemaVersion = 'v0.2.0';

/**
 * Sort order options for extraction.
 */
export type ExtractionSortOrder = '' | 'id' | 'modified_date' | 'created_date';

/**
 * Field type discriminator.
 */
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
  | 'type_key'
  | 'record_type_privilege'
  | 'field_privilege'
  | 'conditional_privilege';

/**
 * Reference type indicating parent-child relationship.
 */
export type ReferenceType = 'child' | 'parent';

/**
 * Comparator for field conditions.
 */
export type FieldConditionComparator = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';

/**
 * Effect applied when a field condition is met.
 */
export type FieldConditionEffect = 'require' | 'show';

/**
 * Scope of a record type.
 */
export type RecordTypeScope = 'metadata_is_system_scoped' | 'data_is_system_scoped';

/**
 * Collection constraints for fields that are collections of values.
 */
export interface CollectionData {
  min_length?: number;
  max_length?: number;
}

/**
 * Integer field constraints.
 */
export interface IntData {
  min?: number;
  max?: number;
}

/**
 * Float field constraints.
 */
export interface FloatData {
  min?: number;
  max?: number;
}

/**
 * Text field constraints.
 */
export interface TextData {
  min_length?: number;
  max_length?: number;
}

/**
 * Enum value definition.
 */
export interface EnumValue {
  /** The enum value that actually occurs in the json data */
  key: string;
  /** The human readable name of the enum value */
  name?: string;
  description?: string;
  /** Deprecated enum values may still occur in the data, but should not be used in new data */
  is_deprecated?: boolean;
}

/**
 * Enum field data containing possible values.
 */
export interface EnumData {
  values: EnumValue[];
}

/**
 * Details about how a reference targets another record type.
 */
export interface ReferenceDetail {
  /** The field in the target record type by which it is referenced. Assumed to be the primary key if not set. */
  by_field?: string;
}

/**
 * Reference field data specifying target record types.
 */
export interface ReferenceData {
  /** The record types that this reference can refer to */
  refers_to: Record<string, ReferenceDetail>;
  /** The parent reference refers to a record that has special ownership over the child */
  reference_type?: ReferenceType;
}

/**
 * Typed reference field data specifying target record types.
 */
export interface TypedReferenceData {
  /** The record types that this reference can refer to */
  refers_to: Record<string, ReferenceDetail>;
  /** The parent reference refers to a record that has special ownership over the child */
  reference_type?: ReferenceType;
}

/**
 * Struct field data referencing a struct type.
 */
export interface StructData {
  key?: string;
}

/**
 * Permission data associating a reference with a role.
 */
export interface PermissionData {
  member_id?: ReferenceData;
  role?: EnumData;
}

/**
 * Conditional privilege data for authorization.
 */
export interface ConditionalPrivilegeData {
  /** The possible record types or record type categories that can be targeted in conditional privilege. */
  type_keys: string[];
}

/**
 * Field privilege data for authorization.
 */
export interface FieldPrivilegeData {
  /** The possible record types or record type categories that can be targeted in field privilege. */
  type_keys: string[];
}

/**
 * Record type privilege data for authorization.
 */
export interface RecordTypePrivilegeData {
  /** The possible record types or record type categories that can be targeted in record type privilege. */
  type_keys: string[];
}

/**
 * Target type key data for authorization policy.
 */
export interface TargetTypeKeyData {
  /** The possible record types or record type categories that can be targeted in authorization policy. */
  type_keys: string[];
}

/**
 * Field reference data (currently empty, reserved for future use).
 */
export interface FieldReferenceData {
  [key: string]: never;
}

/**
 * Extraction data for record types.
 */
export interface ExtractionData {
  sort_order?: ExtractionSortOrder;
}

/**
 * Loading data (currently empty, reserved for future use).
 */
export interface LoadingData {
  [key: string]: never;
}

/**
 * Field definition with type discriminator and type-specific data.
 */
export interface Field {
  /** The type of the field */
  type: FieldType;
  /** The human readable name of the field */
  name?: string;
  description?: string;
  /** Required fields are required in the domain model of the external system. */
  is_required?: boolean;
  /** Read only fields can't be set (when creating or updating a record), but are filled in by some process in the system. */
  is_read_only?: boolean | null;
  /** Fields that are write only should only be written to. */
  is_write_only?: boolean | null;
  /** Indexed fields can be used for searching, sorting or filtering. */
  is_indexed?: boolean | null;
  /** Indicates that the field can be used to uniquely lookup a record. */
  is_identifier?: boolean | null;
  /** Default value for the field */
  default_value?: boolean | number | string;
  /** If collection is set, the field is a 'collection' of the given type. */
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
}

/**
 * Field condition definition.
 */
export interface FieldCondition {
  /** The value of the controlling field that will be compared against to see if the condition is met. */
  value: unknown;
  /** The comparator that will be used to compare the controlling field's value against the Value. */
  comparator: FieldConditionComparator;
  /** The fields that will be affected by the condition being met. */
  affected_fields: string[];
  /** The effect that will be applied to the affected fields if the condition is met. */
  effect: FieldConditionEffect;
}

/**
 * Array of field conditions.
 */
export type FieldConditions = FieldCondition[];

/**
 * Custom link names for forward and backward directions.
 */
export interface CustomLinkNames {
  /** The forward name of the link */
  forward_name: string;
  /** The backward name of the link */
  backward_name: string;
}

/**
 * Custom link data for defining link types.
 */
export interface CustomLinkData {
  /** The field that defines the link types in the system. */
  link_type_field: string;
  link_direction_names: Record<string, CustomLinkNames> | null;
}

/**
 * Custom stage definition in a stage diagram.
 */
export interface CustomStage {
  /** The state this stage belongs to. Must match the ones defined in the diagram 'states' field or be one of the default options: 'open', 'in_progress', 'closed'. */
  state?: string;
  /** A list of stage names that this stage can transition to. */
  transitions_to?: string[];
}

/**
 * Custom state definition in a stage diagram.
 */
export interface CustomState {
  /** The human readable name of the custom state. */
  name: string;
  /** Denotes that this state is an end state. */
  is_end_state?: boolean;
  /** The sort order of the state. */
  ordinal?: number;
}

/**
 * Stage diagram definition for record type workflow.
 */
export interface StageDiagram {
  /** The field that represents the stage in the external system. */
  controlling_field: string;
  /** A map of the stages that should be created. Keys must match the enum values in the controlling field. */
  stages: Record<string, CustomStage>;
  /** The stage that the parent record type starts in when it is created. */
  starting_stage?: string;
  /** A map of the states/status categories that should be created. */
  states?: Record<string, CustomState>;
  /** Denotes that this diagram has no explicit transitions and should be created as an 'all-to-all' diagram. */
  all_transitions_allowed?: boolean;
}

/**
 * Record type category definition.
 */
export interface RecordTypeCategory {
  /** The human readable name of the record type category */
  name?: string;
  /** Indicates whether a record can move between the record types of this category while preserving its identity */
  are_record_type_conversions_possible?: boolean;
}

/**
 * Record type definition.
 */
export interface RecordType {
  /** The fields of the record type */
  fields: Record<string, Field>;
  /** The human readable name of the record type */
  name?: string;
  description?: string;
  category?: string;
  /** Whether the record type can be loaded (connector supports creating it in the system) */
  is_loadable?: boolean;
  /** Whether the record type sends the complete system state in every sync */
  is_snapshot?: boolean;
  /** Denotes that the record type has no ID field, primarily used for authorization policies */
  no_identifier?: boolean;
  /** Indicates the scope of this record type */
  scope?: RecordTypeScope;
  /** Field conditions for this record type */
  conditions?: Record<string, FieldConditions>;
  /** Stage diagram for workflow */
  stage_diagram?: StageDiagram;
  /** Link naming data for custom links */
  link_naming_data?: CustomLinkData;
}

/**
 * Struct type definition for reusable field structures.
 */
export interface StructType {
  /** The fields of the struct type */
  fields: Record<string, Field>;
  /** The human readable name of the struct type */
  name?: string;
}

/**
 * External domain metadata describing the logical structure of an external system.
 */
export interface ExternalDomainMetadata {
  /** The record types in the domain */
  record_types: Record<string, RecordType>;
  /** Record type categories */
  record_type_categories?: Record<string, RecordTypeCategory>;
  /** Struct types for reusable field structures */
  struct_types?: Record<string, StructType>;
  /** The schema version of the metadata format itself. */
  schema_version?: SchemaVersion;
}
