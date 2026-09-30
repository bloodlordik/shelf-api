import { PartsSnapshotService } from './parts-snapshot.service';
import { AttributeDefinition } from '../../attributes/entities/attribute-definition.entity';
import { AttributeDataType } from '../../attributes/enums/attribute-data-type.enum';
import { Unit } from '../../units/entities/unit.entity';
import { UnitGroup } from '../../units/enums/unit-group.enum';
import { Tag } from '../../tags/entities/tag.entity';

describe('PartsSnapshotService', () => {
  let service: PartsSnapshotService;

  beforeEach(() => {
    service = new PartsSnapshotService();
  });

  it('should build an empty snapshot when no attributes or tags are provided', () => {
    const snapshot = service.buildSnapshot({ attributes: [] });
    expect(snapshot).toEqual({
      tags: [],
      tag_ids: [],
      _meta: {},
    });
  });

  it('should correctly format tags and dynamic attributes into JSONB projection with _meta', () => {
    const unit: Unit = {
      id: 'u1',
      name: 'Вольт',
      symbol: 'В',
      group: UnitGroup.ELECTRICAL,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const voltageDef: AttributeDefinition = {
      id: 'd1',
      key: 'nominal_voltage',
      label: 'Номинальное напряжение',
      dataType: AttributeDataType.NUMBER,
      unitId: 'u1',
      unit,
      isRequired: false,
      isMultiple: false,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const pkgDef: AttributeDefinition = {
      id: 'd2',
      key: 'package_type',
      label: 'Тип корпуса',
      dataType: AttributeDataType.ENUM,
      unitId: null,
      isRequired: false,
      isMultiple: false,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const certsDef: AttributeDefinition = {
      id: 'd3',
      key: 'certifications',
      label: 'Сертификаты',
      dataType: AttributeDataType.MULTI_ENUM,
      unitId: null,
      isRequired: false,
      isMultiple: true,
      sortOrder: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const tags: Tag[] = [
      {
        id: 't1',
        name: 'SMD',
        color: '#3B82F6',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 't2',
        name: 'In Stock',
        color: '#10B981',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const snapshot = service.buildSnapshot({
      tags,
      attributes: [
        {
          definition: voltageDef,
          items: [{ value_number: 12.0 }],
        },
        {
          definition: pkgDef,
          items: [{ option_value: 'smd_0805', option_label: 'SMD 0805' }],
        },
        {
          definition: certsDef,
          items: [
            { option_value: 'iso9001', option_label: 'ISO 9001' },
            { option_value: 'aec_q200', option_label: 'AEC-Q200' },
          ],
        },
      ],
    });

    expect(snapshot.tags).toEqual(['smd', 'in stock']);
    expect(snapshot.tag_ids).toEqual(['t1', 't2']);
    expect(snapshot.nominal_voltage).toBe(12.0);
    expect(snapshot.package_type).toBe('smd_0805');
    expect(snapshot.certifications).toEqual(['iso9001', 'aec_q200']);

    expect(snapshot._meta).toEqual({
      nominal_voltage: {
        type: 'number',
        label: 'Номинальное напряжение',
        unit: 'В',
      },
      package_type: {
        type: 'enum',
        label: 'Тип корпуса',
        unit: null,
        optionLabel: 'SMD 0805',
      },
      certifications: {
        type: 'multi_enum',
        label: 'Сертификаты',
        unit: null,
        optionLabels: ['ISO 9001', 'AEC-Q200'],
      },
    });
  });
});
