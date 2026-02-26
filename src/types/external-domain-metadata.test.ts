// Tests that the TS types and JSON schema agree on what data is valid.
// We build typed objects (checked by TS at compile time) and validate them
// against the JSON schema at runtime using Ajv, catching any drift between the two.

import Ajv, { ValidateFunction } from 'ajv';
import * as schema from '../../external_domain_metadata_schema.json';
import { ExternalDomainMetadata, Field } from './external-domain-metadata';

const ajv = new Ajv({ allErrors: true });
const validate: ValidateFunction = ajv.compile(schema);

function expectSchemaValid(data: unknown): void {
  const valid = validate(data);
  if (!valid) {
    fail(
      `Expected schema validation to pass but got errors:\n${JSON.stringify(
        validate.errors,
        null,
        2
      )}`
    );
  }
}

function expectSchemaInvalid(data: unknown): void {
  expect(validate(data)).toBe(false);
}

function edmWithField(field: object): ExternalDomainMetadata {
  return {
    record_types: {
      test_record: {
        fields: {
          test_field: field as Field,
        },
      },
    },
  };
}

describe('ExternalDomainMetadata schema-type consistency', () => {
  describe('valid data accepted by both TS types and schema', () => {
    it('minimal metadata with empty record_types', () => {
      const data: ExternalDomainMetadata = { record_types: {} };
      expectSchemaValid(data);
    });

    it('full metadata with all optional top-level properties', () => {
      const data: ExternalDomainMetadata = {
        record_types: {
          issue: {
            fields: {
              title: { type: 'text', text: { max_length: 255 } },
            },
            name: 'Issue',
            description: 'A work item',
            is_loadable: true,
            is_snapshot: false,
            no_identifier: false,
            scope: 'metadata_is_system_scoped',
          },
        },
        record_type_categories: {
          work_items: {
            name: 'Work Items',
            are_record_type_conversions_possible: true,
          },
        },
        struct_types: {
          address: {
            fields: {
              street: { type: 'text' },
            },
            name: 'Address',
          },
        },
        schema_version: 'v0.2.0',
      };
      expectSchemaValid(data);
    });

    it('record type with category', () => {
      const data: ExternalDomainMetadata = {
        record_types: {
          bug: {
            fields: { title: { type: 'text' } },
            category: 'work_items',
          },
        },
        record_type_categories: {
          work_items: { name: 'Work Items' },
        },
      };
      expectSchemaValid(data);
    });

    describe('field types', () => {
      it('bool field', () => {
        expectSchemaValid(edmWithField({ type: 'bool', default_value: true }));
      });

      it('int field', () => {
        expectSchemaValid(
          edmWithField({
            type: 'int',
            int: { min: 0, max: 100 },
            default_value: 42,
          })
        );
      });

      it('float field', () => {
        expectSchemaValid(
          edmWithField({
            type: 'float',
            float: { min: 0.0, max: 1.0 },
            default_value: 0.5,
          })
        );
      });

      it('text field', () => {
        expectSchemaValid(
          edmWithField({
            type: 'text',
            text: { min_length: 1, max_length: 255 },
            default_value: 'hello',
          })
        );
      });

      it('rich_text field', () => {
        expectSchemaValid(edmWithField({ type: 'rich_text' }));
      });

      it('enum field with values', () => {
        expectSchemaValid(
          edmWithField({
            type: 'enum',
            enum: {
              values: [
                { key: 'low', name: 'Low' },
                { key: 'high', name: 'High', is_deprecated: true },
              ],
            },
            default_value: 'low',
          })
        );
      });

      it('enum field with null enum data', () => {
        expectSchemaValid(
          edmWithField({
            type: 'enum',
            enum: null,
          })
        );
      });

      it('reference field', () => {
        expectSchemaValid(
          edmWithField({
            type: 'reference',
            reference: {
              refers_to: { user: { by_field: 'email' } },
              reference_type: 'parent',
            },
          })
        );
      });

      it('typed_reference field', () => {
        expectSchemaValid(
          edmWithField({
            type: 'typed_reference',
            typed_reference: {
              refers_to: { issue: {}, bug: {} },
              reference_type: 'child',
            },
          })
        );
      });

      it('struct field', () => {
        expectSchemaValid(
          edmWithField({
            type: 'struct',
            struct: { key: 'address' },
          })
        );
      });

      it('date field', () => {
        expectSchemaValid(
          edmWithField({ type: 'date', default_value: '2024-01-01' })
        );
      });

      it('timestamp field', () => {
        expectSchemaValid(
          edmWithField({
            type: 'timestamp',
            default_value: '2024-01-01T00:00:00Z',
          })
        );
      });

      it('permission field', () => {
        expectSchemaValid(
          edmWithField({
            type: 'permission',
            permission: {
              member_id: { refers_to: { user: {} } },
              role: { values: [{ key: 'admin' }] },
            },
          })
        );
      });

      it('record_type_privilege field', () => {
        expectSchemaValid(
          edmWithField({
            type: 'record_type_privilege',
            record_type_privilege: { type_keys: ['issue'] },
          })
        );
      });

      it('field_privilege field with data', () => {
        expectSchemaValid(
          edmWithField({
            type: 'field_privilege',
            field_privilege: { type_keys: ['issue'] },
          })
        );
      });
    });

    describe('common field properties', () => {
      it('field with all optional properties', () => {
        expectSchemaValid(
          edmWithField({
            type: 'text',
            text: { min_length: 0, max_length: 500 },
            name: 'Title',
            description: 'The title of the item',
            is_required: true,
            is_read_only: false,
            is_write_only: false,
            is_indexed: true,
            is_identifier: false,
            default_value: 'Untitled',
            collection: { min_length: 0, max_length: 10 },
          })
        );
      });

      it('nullable boolean properties accept null', () => {
        expectSchemaValid(
          edmWithField({
            type: 'bool',
            is_read_only: null,
            is_write_only: null,
            is_indexed: null,
            is_identifier: null,
          })
        );
      });

      it('field with collection data', () => {
        expectSchemaValid(
          edmWithField({
            type: 'text',
            collection: { min_length: 1, max_length: 50 },
          })
        );
      });
    });

    describe('field conditions', () => {
      it('record type with valid conditions', () => {
        const data: ExternalDomainMetadata = {
          record_types: {
            ticket: {
              fields: {
                priority: {
                  type: 'enum',
                  enum: {
                    values: [{ key: 'high' }, { key: 'low' }],
                  },
                },
                escalation_contact: { type: 'text' },
              },
              conditions: {
                priority: [
                  {
                    value: 'high',
                    comparator: 'eq',
                    affected_fields: ['escalation_contact'],
                    effect: 'require',
                  },
                ],
              },
            },
          },
        };
        expectSchemaValid(data);
      });
    });

    describe('stage diagram', () => {
      it('record type with stage diagram', () => {
        const data: ExternalDomainMetadata = {
          record_types: {
            issue: {
              fields: {
                status: {
                  type: 'enum',
                  enum: {
                    values: [
                      { key: 'new' },
                      { key: 'in_progress' },
                      { key: 'done' },
                    ],
                  },
                },
              },
              stage_diagram: {
                controlling_field: 'status',
                stages: {
                  new: {
                    state: 'open',
                    transitions_to: ['in_progress'],
                  },
                  in_progress: {
                    state: 'in_progress',
                    transitions_to: ['done'],
                  },
                  done: { state: 'closed' },
                },
                starting_stage: 'new',
                states: {
                  open: { name: 'Open', ordinal: 1 },
                  in_progress: { name: 'In Progress', ordinal: 2 },
                  closed: { name: 'Closed', is_end_state: true, ordinal: 3 },
                },
              },
            },
          },
        };
        expectSchemaValid(data);
      });

      it('stage diagram with all_transitions_allowed', () => {
        const data: ExternalDomainMetadata = {
          record_types: {
            issue: {
              fields: {
                status: {
                  type: 'enum',
                  enum: {
                    values: [{ key: 'open' }, { key: 'closed' }],
                  },
                },
              },
              stage_diagram: {
                controlling_field: 'status',
                stages: {
                  open: { state: 'open' },
                  closed: { state: 'closed' },
                },
                all_transitions_allowed: true,
              },
            },
          },
        };
        expectSchemaValid(data);
      });
    });

    describe('custom link data', () => {
      it('link naming data with direction names', () => {
        const data: ExternalDomainMetadata = {
          record_types: {
            issue: {
              fields: {
                link_type: { type: 'text' },
              },
              link_naming_data: {
                link_type_field: 'link_type',
                link_direction_names: {
                  blocks: {
                    forward_name: 'blocks',
                    backward_name: 'is blocked by',
                  },
                },
              },
            },
          },
        };
        expectSchemaValid(data);
      });

      it('link naming data with null direction names', () => {
        const data: ExternalDomainMetadata = {
          record_types: {
            issue: {
              fields: {
                link_type: { type: 'text' },
              },
              link_naming_data: {
                link_type_field: 'link_type',
                link_direction_names: null,
              },
            },
          },
        };
        expectSchemaValid(data);
      });
    });
  });

  describe('invalid data rejected by schema', () => {
    it('rejects missing record_types', () => {
      expectSchemaInvalid({});
    });

    it('rejects record_types as array', () => {
      expectSchemaInvalid({ record_types: [] });
    });

    it('rejects field without type', () => {
      expectSchemaInvalid(
        edmWithField({ name: 'missing type' } as unknown as Field)
      );
    });

    it('rejects invalid field type value', () => {
      expectSchemaInvalid(edmWithField({ type: 'unknown_type' }));
    });

    it('rejects reference field missing refers_to', () => {
      expectSchemaInvalid(edmWithField({ type: 'reference', reference: {} }));
    });

    it('rejects enum field missing enum data', () => {
      // Schema requires "enum" property when type is "enum" (via oneOf)
      expectSchemaInvalid(edmWithField({ type: 'enum' }));
    });

    it('rejects typed_reference field missing typed_reference data', () => {
      expectSchemaInvalid(edmWithField({ type: 'typed_reference' }));
    });

    it('rejects struct field missing struct data', () => {
      expectSchemaInvalid(edmWithField({ type: 'struct' }));
    });

    it('rejects invalid comparator value', () => {
      const data: ExternalDomainMetadata = {
        record_types: {
          ticket: {
            fields: { f: { type: 'text' } },
            conditions: {
              f: [
                {
                  value: 'x',
                  comparator: 'invalid' as 'eq',
                  affected_fields: ['f'],
                  effect: 'require',
                },
              ],
            },
          },
        },
      };
      expectSchemaInvalid(data);
    });

    it('rejects invalid effect value', () => {
      const data: ExternalDomainMetadata = {
        record_types: {
          ticket: {
            fields: { f: { type: 'text' } },
            conditions: {
              f: [
                {
                  value: 'x',
                  comparator: 'eq',
                  affected_fields: ['f'],
                  effect: 'hide' as 'show',
                },
              ],
            },
          },
        },
      };
      expectSchemaInvalid(data);
    });

    it('rejects invalid scope value', () => {
      const data = {
        record_types: {
          item: {
            fields: { id: { type: 'text' } },
            scope: 'invalid_scope',
          },
        },
      };
      expectSchemaInvalid(data);
    });

    it('rejects invalid reference_type value', () => {
      expectSchemaInvalid(
        edmWithField({
          type: 'reference',
          reference: {
            refers_to: { target: {} },
            reference_type: 'sibling',
          },
        })
      );
    });

    it('rejects invalid schema_version value', () => {
      expectSchemaInvalid({
        record_types: {},
        schema_version: 'v1.0.0',
      });
    });

    it('rejects additional properties at root level', () => {
      expectSchemaInvalid({
        record_types: {},
        unknown_property: true,
      });
    });

    it('rejects additional properties on record type', () => {
      expectSchemaInvalid({
        record_types: {
          item: {
            fields: { id: { type: 'text' } },
            unknown_prop: true,
          },
        },
      });
    });
  });

  describe('TS-valid but schema-invalid (discrepancies)', () => {
    it('schema rejects cross-type data on a field (TS allows it)', () => {
      // TS Field interface is flat and allows all type-specific data at once.
      // Schema oneOf enforces that only the matching type-specific property is present.
      const field: Field = { type: 'bool', int: { min: 0 } };
      expectSchemaInvalid(edmWithField(field));
    });

    it('schema rejects wrong default_value type for bool field (TS allows boolean | number | string)', () => {
      const field: Field = { type: 'bool', default_value: 'not_a_boolean' };
      expectSchemaInvalid(edmWithField(field));
    });

    it('schema rejects string default_value for int field', () => {
      const field: Field = { type: 'int', default_value: 'hello' };
      expectSchemaInvalid(edmWithField(field));
    });

    it('schema rejects boolean default_value for text field', () => {
      const field: Field = { type: 'text', default_value: true };
      expectSchemaInvalid(edmWithField(field));
    });

    it('schema allows default_value on rich_text (no restriction in oneOf variant), TS restricts to boolean|number|string', () => {
      // The rich_text oneOf variant doesn't mention default_value at all,
      // so the top-level "default_value: {}" (any type) applies.
      // TS is more restrictive here: default_value?: boolean | number | string.
      const field: Field = { type: 'rich_text', default_value: 'content' };
      expectSchemaValid(edmWithField(field));
    });

    it('schema rejects float values in IntData (TS number allows floats)', () => {
      const field: Field = { type: 'int', int: { min: 1.5, max: 10.7 } };
      expectSchemaInvalid(edmWithField(field));
    });

    it('[schema bug] conditional_privilege type always fails schema validation', () => {
      // The last oneOf variant uses type.enum: ["field_privilege"] instead of ["conditional_privilege"].
      // So type: "conditional_privilege" matches zero oneOf variants.
      const field: Field = {
        type: 'conditional_privilege',
        conditional_privilege: { type_keys: ['issue'] },
      };
      expectSchemaInvalid(edmWithField(field));
    });

    it('[schema bug] bare field_privilege without type-specific data fails schema (two oneOf matches)', () => {
      // Both the field_privilege and conditional_privilege oneOf variants
      // have type.enum: ["field_privilege"], so a bare field_privilege with
      // no type-specific data matches both variants, violating oneOf.
      const field: Field = { type: 'field_privilege' };
      expectSchemaInvalid(edmWithField(field));
    });

    it('[schema workaround] field_privilege type with conditional_privilege data passes schema', () => {
      // Due to the schema bug, conditional_privilege data must use type: "field_privilege"
      expectSchemaValid(
        edmWithField({
          type: 'field_privilege',
          conditional_privilege: { type_keys: ['issue'] },
        })
      );
    });

    it('type_key field type is valid in schema but removed from TS FieldType', () => {
      // type_key is deprecated and removed from FieldType, but the schema still accepts it.
      expectSchemaValid(
        edmWithField({
          type: 'type_key',
          type_key: { type_keys: ['issue', 'bug'] },
        })
      );
    });

    it('schema accepts comparators lt/lte/gt/gte that TS FieldConditionComparator no longer includes', () => {
      // FieldConditionComparator was narrowed to 'eq' | 'ne', but the schema still accepts all six.
      for (const comparator of ['lt', 'lte', 'gt', 'gte']) {
        const data = {
          record_types: {
            ticket: {
              fields: { f: { type: 'text' } },
              conditions: {
                f: [
                  {
                    value: 'x',
                    comparator,
                    affected_fields: ['f'],
                    effect: 'require',
                  },
                ],
              },
            },
          },
        };
        expectSchemaValid(data);
      }
    });
  });

  describe('edge cases: schema constraints not enforced by TS', () => {
    it('schema rejects StageDiagram.stages with fewer than 2 entries (minProperties: 2)', () => {
      const data = {
        record_types: {
          issue: {
            fields: {
              status: {
                type: 'enum',
                enum: { values: [{ key: 'open' }] },
              },
            },
            stage_diagram: {
              controlling_field: 'status',
              stages: {
                open: { state: 'open' },
              },
            },
          },
        },
      };
      expectSchemaInvalid(data);
    });

    it('schema rejects empty affected_fields array (minItems: 1)', () => {
      const data = {
        record_types: {
          ticket: {
            fields: { f: { type: 'text' } },
            conditions: {
              f: [
                {
                  value: 'x',
                  comparator: 'eq',
                  affected_fields: [],
                  effect: 'require',
                },
              ],
            },
          },
        },
      };
      expectSchemaInvalid(data);
    });

    it('schema rejects empty controlling_field string (minLength: 1)', () => {
      const data = {
        record_types: {
          issue: {
            fields: {
              status: {
                type: 'enum',
                enum: {
                  values: [{ key: 'a' }, { key: 'b' }],
                },
              },
            },
            stage_diagram: {
              controlling_field: '',
              stages: {
                a: { state: 'open' },
                b: { state: 'closed' },
              },
            },
          },
        },
      };
      expectSchemaInvalid(data);
    });

    it('schema rejects empty link_type_field string (minLength: 1)', () => {
      const data = {
        record_types: {
          issue: {
            fields: { f: { type: 'text' } },
            link_naming_data: {
              link_type_field: '',
              link_direction_names: null,
            },
          },
        },
      };
      expectSchemaInvalid(data);
    });

    it('schema rejects negative min_length in CollectionData (minimum: 0)', () => {
      expectSchemaInvalid(
        edmWithField({
          type: 'text',
          collection: { min_length: -1 },
        })
      );
    });

    it('schema rejects float value for TextData.max_length (type: integer)', () => {
      expectSchemaInvalid(
        edmWithField({
          type: 'text',
          text: { max_length: 100.5 },
        })
      );
    });

    it('schema rejects float value for CollectionData.min_length (type: integer)', () => {
      expectSchemaInvalid(
        edmWithField({
          type: 'text',
          collection: { min_length: 1.5 },
        })
      );
    });

    it('schema rejects float value for CustomState.ordinal (type: integer)', () => {
      const data = {
        record_types: {
          issue: {
            fields: {
              status: {
                type: 'enum',
                enum: { values: [{ key: 'a' }, { key: 'b' }] },
              },
            },
            stage_diagram: {
              controlling_field: 'status',
              stages: {
                a: { state: 'open' },
                b: { state: 'closed' },
              },
              states: {
                open: { name: 'Open', ordinal: 1.5 },
              },
            },
          },
        },
      };
      expectSchemaInvalid(data);
    });

    it('empty record_types map is valid', () => {
      expectSchemaValid({ record_types: {} });
    });

    it('empty fields map on record type is valid', () => {
      expectSchemaValid({
        record_types: { empty: { fields: {} } },
      });
    });
  });
});
