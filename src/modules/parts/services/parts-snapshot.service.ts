import { Injectable } from '@nestjs/common';
import { AttributeDefinition } from '../../attributes/entities/attribute-definition.entity';
import { AttributeDataType } from '../../attributes/enums/attribute-data-type.enum';
import { Tag } from '../../tags/entities/tag.entity';
import { FormattedAttributeItem } from '../../attributes/services/attributes-validation.service';

export interface SnapshotMetaItem {
  type: string;
  label: string;
  unit?: string | null;
  optionLabel?: string;
  optionLabels?: string[];
}

export interface PartSnapshotInput {
  tags?: Tag[];
  attributes: Array<{
    definition: AttributeDefinition;
    items: FormattedAttributeItem[];
  }>;
}

@Injectable()
export class PartsSnapshotService {
  buildSnapshot(input: PartSnapshotInput): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};
    const meta: Record<string, SnapshotMetaItem> = {};

    // 1. Process tags if present
    if (input.tags && input.tags.length > 0) {
      snapshot.tags = input.tags.map((t) => t.name.toLowerCase());
      snapshot.tag_ids = input.tags.map((t) => t.id);
    } else {
      snapshot.tags = [];
      snapshot.tag_ids = [];
    }

    // 2. Process validated attributes
    for (const { definition: def, items } of input.attributes) {
      if (!items || items.length === 0) {
        continue;
      }

      const metaItem: SnapshotMetaItem = {
        type: def.dataType,
        label: def.label,
        unit: def.unit ? def.unit.symbol : null,
      };

      if (def.isMultiple || def.dataType === AttributeDataType.MULTI_ENUM) {
        // Collect array of values
        const values: unknown[] = [];
        const optionLabels: string[] = [];

        for (const item of items) {
          const val = this.extractValue(def.dataType, item);
          if (val !== undefined && val !== null) {
            values.push(val);
          }
          if (item.option_label) {
            optionLabels.push(item.option_label);
          }
        }

        snapshot[def.key] = values;
        if (optionLabels.length > 0) {
          metaItem.optionLabels = optionLabels;
        }
      } else {
        // Single scalar value
        const item = items[0];
        const val = this.extractValue(def.dataType, item);
        snapshot[def.key] = val;
        if (item.option_label) {
          metaItem.optionLabel = item.option_label;
        }
      }

      meta[def.key] = metaItem;
    }

    snapshot._meta = meta;
    return snapshot;
  }

  private extractValue(
    dataType: AttributeDataType,
    item: FormattedAttributeItem,
  ): unknown {
    switch (dataType) {
      case AttributeDataType.NUMBER:
      case AttributeDataType.MONEY:
        return item.value_number ?? null;

      case AttributeDataType.BOOLEAN:
        return item.value_boolean ?? null;

      case AttributeDataType.DATE:
        return item.value_date instanceof Date
          ? item.value_date.toISOString()
          : (item.value_date ?? null);

      case AttributeDataType.ENUM:
      case AttributeDataType.MULTI_ENUM:
        return item.option_value ?? item.value_option_id ?? null;

      case AttributeDataType.REFERENCE:
        return item.value_reference_id ?? null;

      case AttributeDataType.TEXT:
      case AttributeDataType.LONG_TEXT:
      case AttributeDataType.FILE:
      default:
        return item.value_string ?? null;
    }
  }
}
