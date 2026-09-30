import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
import { AttributeOption } from '../entities/attribute-option.entity';
import { AttributeDataType } from '../enums/attribute-data-type.enum';
import {
  AttributeValidationException,
  AttributeValidationErrorDetail,
} from '../../../common/exceptions/attribute-validation.exception';

export interface RawAttributeInput {
  key?: string;
  attributeDefinitionId?: string;
  value: unknown;
}

export interface FormattedAttributeItem {
  value_string?: string | null;
  value_number?: number | null;
  value_boolean?: boolean | null;
  value_date?: Date | null;
  value_option_id?: string | null;
  value_reference_id?: string | null;
  option_value?: string;
  option_label?: string;
}

export interface ValidatedAttributeRecord {
  definition: AttributeDefinition;
  items: FormattedAttributeItem[];
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatValueForDisplay(val: unknown): string {
  if (
    typeof val === 'string' ||
    typeof val === 'number' ||
    typeof val === 'boolean'
  ) {
    return String(val);
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return JSON.stringify(val);
}
@Injectable()
export class AttributesValidationService {
  constructor(
    @InjectRepository(AttributeDefinition)
    private readonly definitionRepository: Repository<AttributeDefinition>,
    @InjectRepository(AttributeOption)
    private readonly optionRepository: Repository<AttributeOption>,
  ) {}

  /**
   * Loads and validates dynamic attributes for a part creation or update.
   * @param rawInputs Array of attribute inputs (key/ID + value)
   * @param isPartialUpdate If true, does not fail missing is_required definitions
   */
  async validateAttributes(
    rawInputs: RawAttributeInput[] = [],
    isPartialUpdate: boolean = false,
  ): Promise<ValidatedAttributeRecord[]> {
    const errors: AttributeValidationErrorDetail[] = [];

    // 1. Fetch all definitions with their options and units
    const allDefinitions = await this.definitionRepository.find({
      relations: { options: true, unit: true },
      order: { sortOrder: 'ASC' },
    });

    const defByKey = new Map<string, AttributeDefinition>();
    const defById = new Map<string, AttributeDefinition>();
    for (const def of allDefinitions) {
      defByKey.set(def.key, def);
      defById.set(def.id, def);
    }

    // 2. Map inputs to definitions
    const inputsByDefId = new Map<
      string,
      { raw: RawAttributeInput; def: AttributeDefinition }
    >();

    for (const input of rawInputs) {
      let def: AttributeDefinition | undefined;
      if (input.attributeDefinitionId) {
        def = defById.get(input.attributeDefinitionId);
      } else if (input.key) {
        def = defByKey.get(input.key);
      }

      if (!def) {
        errors.push({
          field: input.key || input.attributeDefinitionId || 'unknown',
          key: input.key,
          attributeDefinitionId: input.attributeDefinitionId,
          message: `Attribute definition '${input.key || input.attributeDefinitionId}' not found`,
          value: input.value,
        });
        continue;
      }

      inputsByDefId.set(def.id, { raw: input, def });
    }

    // 3. Check is_required on all definitions if full create
    if (!isPartialUpdate) {
      for (const def of allDefinitions) {
        if (def.isRequired && !inputsByDefId.has(def.id)) {
          errors.push({
            field: def.key,
            key: def.key,
            attributeDefinitionId: def.id,
            message: `Attribute '${def.label}' (${def.key}) is required`,
          });
        }
      }
    }

    // 4. Validate each supplied attribute input
    const validatedRecords: ValidatedAttributeRecord[] = [];

    for (const [, { raw, def }] of inputsByDefId) {
      const rawValue = raw.value;

      // Check for empty required values
      if (def.isRequired) {
        if (
          rawValue === null ||
          rawValue === undefined ||
          rawValue === '' ||
          (Array.isArray(rawValue) && rawValue.length === 0)
        ) {
          errors.push({
            field: def.key,
            key: def.key,
            attributeDefinitionId: def.id,
            message: `Required attribute '${def.label}' (${def.key}) cannot be empty`,
            value: rawValue,
          });
          continue;
        }
      }

      // If value is null/undefined/empty and not required, record empty or skip
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        validatedRecords.push({ definition: def, items: [] });
        continue;
      }

      // Check is_multiple
      const isArray = Array.isArray(rawValue);
      if (!def.isMultiple && isArray && rawValue.length > 1) {
        errors.push({
          field: def.key,
          key: def.key,
          attributeDefinitionId: def.id,
          message: `Attribute '${def.label}' does not support multiple values`,
          value: rawValue,
        });
        continue;
      }

      const valuesToValidate: unknown[] = isArray ? rawValue : [rawValue];
      const items: FormattedAttributeItem[] = [];

      for (let i = 0; i < valuesToValidate.length; i++) {
        const val = valuesToValidate[i];
        const validationResult = this.validateSingleValue(def, val, i);
        if (validationResult.error) {
          errors.push(validationResult.error);
        } else if (validationResult.item) {
          items.push(validationResult.item);
        }
      }

      validatedRecords.push({ definition: def, items });
    }

    if (errors.length > 0) {
      throw new AttributeValidationException(errors);
    }

    return validatedRecords;
  }

  private validateSingleValue(
    def: AttributeDefinition,
    val: unknown,
    index: number,
  ): { error?: AttributeValidationErrorDetail; item?: FormattedAttributeItem } {
    const errorPrefix = def.isMultiple ? `Element [${index}]: ` : '';

    if (val === null || val === undefined) {
      return {};
    }

    switch (def.dataType) {
      case AttributeDataType.TEXT: {
        if (typeof val !== 'string' && typeof val !== 'number') {
          return {
            error: {
              field: def.key,
              key: def.key,
              attributeDefinitionId: def.id,
              message: `${errorPrefix}Expected string for text attribute, got ${typeof val}`,
              value: val,
            },
          };
        }
        const strVal = String(val);
        if (strVal.length > 1000) {
          return {
            error: {
              field: def.key,
              key: def.key,
              attributeDefinitionId: def.id,
              message: `${errorPrefix}Text exceeds maximum length of 1000 characters`,
              value: strVal,
            },
          };
        }
        return { item: { value_string: strVal } };
      }

      case AttributeDataType.LONG_TEXT: {
        if (typeof val !== 'string' && typeof val !== 'number') {
          return {
            error: {
              field: def.key,
              key: def.key,
              attributeDefinitionId: def.id,
              message: `${errorPrefix}Expected string for long_text attribute, got ${typeof val}`,
              value: val,
            },
          };
        }
        return { item: { value_string: String(val) } };
      }

      case AttributeDataType.NUMBER:
      case AttributeDataType.MONEY: {
        const num = typeof val === 'number' ? val : Number(val);
        if (
          isNaN(num) ||
          !isFinite(num) ||
          (typeof val === 'string' && val.trim() === '')
        ) {
          return {
            error: {
              field: def.key,
              key: def.key,
              attributeDefinitionId: def.id,
              message: `${errorPrefix}Expected finite number, got '${formatValueForDisplay(val)}'`,
              value: val,
            },
          };
        }
        return { item: { value_number: num } };
      }

      case AttributeDataType.BOOLEAN: {
        let boolVal: boolean | null = null;
        if (typeof val === 'boolean') {
          boolVal = val;
        } else if (val === 'true' || val === '1' || val === 1) {
          boolVal = true;
        } else if (val === 'false' || val === '0' || val === 0) {
          boolVal = false;
        } else {
          return {
            error: {
              field: def.key,
              key: def.key,
              attributeDefinitionId: def.id,
              message: `${errorPrefix}Expected boolean value, got '${formatValueForDisplay(val)}'`,
              value: val,
            },
          };
        }
        return { item: { value_boolean: boolVal } };
      }

      case AttributeDataType.DATE: {
        const parsed =
          val instanceof Date
            ? val
            : typeof val === 'string' || typeof val === 'number'
              ? new Date(val)
              : null;
        if (!parsed || isNaN(parsed.getTime())) {
          return {
            error: {
              field: def.key,
              key: def.key,
              attributeDefinitionId: def.id,
              message: `${errorPrefix}Expected valid ISO-8601 date, got '${formatValueForDisplay(val)}'`,
              value: val,
            },
          };
        }
        return { item: { value_date: parsed } };
      }

      case AttributeDataType.ENUM:
      case AttributeDataType.MULTI_ENUM: {
        const strVal = formatValueForDisplay(val).trim();
        const options = def.options || [];
        const matched = options.find(
          (opt) => opt.id === strVal || opt.value === strVal,
        );
        if (!matched) {
          const validOptions = options.map((o) => o.value).join(', ');
          return {
            error: {
              field: def.key,
              key: def.key,
              attributeDefinitionId: def.id,
              message: `${errorPrefix}Option '${strVal}' is not valid for '${def.label}'. Valid options: [${validOptions}]`,
              value: val,
            },
          };
        }
        return {
          item: {
            value_option_id: matched.id,
            option_value: matched.value,
            option_label: matched.label,
          },
        };
      }

      case AttributeDataType.REFERENCE: {
        const strVal = formatValueForDisplay(val).trim();
        if (!UUID_REGEX.test(strVal)) {
          return {
            error: {
              field: def.key,
              key: def.key,
              attributeDefinitionId: def.id,
              message: `${errorPrefix}Expected valid UUID for reference attribute, got '${formatValueForDisplay(val)}'`,
              value: val,
            },
          };
        }
        return { item: { value_reference_id: strVal } };
      }

      case AttributeDataType.FILE: {
        if (typeof val !== 'string' || val.trim() === '') {
          return {
            error: {
              field: def.key,
              key: def.key,
              attributeDefinitionId: def.id,
              message: `${errorPrefix}Expected non-empty string URL or file path for file attribute`,
              value: val,
            },
          };
        }
        return { item: { value_string: val.trim() } };
      }

      default:
        return { item: { value_string: formatValueForDisplay(val) } };
    }
  }
}
