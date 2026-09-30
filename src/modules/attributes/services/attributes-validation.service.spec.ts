import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AttributesValidationService } from './attributes-validation.service';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
import { AttributeOption } from '../entities/attribute-option.entity';
import { AttributeDataType } from '../enums/attribute-data-type.enum';
import { AttributeValidationException } from '../../../common/exceptions/attribute-validation.exception';

describe('AttributesValidationService', () => {
  let service: AttributesValidationService;

  const mockDefinitions: Partial<AttributeDefinition>[] = [
    {
      id: 'd1-uuid',
      key: 'nominal_voltage',
      label: 'Номинальное напряжение',
      dataType: AttributeDataType.NUMBER,
      isRequired: true,
      isMultiple: false,
      options: [],
    },
    {
      id: 'd2-uuid',
      key: 'package_type',
      label: 'Тип корпуса',
      dataType: AttributeDataType.ENUM,
      isRequired: false,
      isMultiple: false,
      options: [
        {
          id: 'opt1-uuid',
          attributeDefinitionId: 'd2-uuid',
          value: 'smd_0805',
          label: 'SMD 0805',
          sortOrder: 0,
        } as AttributeOption,
        {
          id: 'opt2-uuid',
          attributeDefinitionId: 'd2-uuid',
          value: 'to_220',
          label: 'TO-220',
          sortOrder: 1,
        } as AttributeOption,
      ],
    },
    {
      id: 'd3-uuid',
      key: 'is_rohs',
      label: 'Соответствие RoHS',
      dataType: AttributeDataType.BOOLEAN,
      isRequired: false,
      isMultiple: false,
      options: [],
    },
    {
      id: 'd4-uuid',
      key: 'certifications',
      label: 'Сертификаты',
      dataType: AttributeDataType.MULTI_ENUM,
      isRequired: false,
      isMultiple: true,
      options: [
        {
          id: 'opt-c1',
          attributeDefinitionId: 'd4-uuid',
          value: 'iso9001',
          label: 'ISO 9001',
          sortOrder: 0,
        } as AttributeOption,
        {
          id: 'opt-c2',
          attributeDefinitionId: 'd4-uuid',
          value: 'aec_q200',
          label: 'AEC-Q200',
          sortOrder: 1,
        } as AttributeOption,
      ],
    },
    {
      id: 'd5-uuid',
      key: 'manufacture_date',
      label: 'Дата производства',
      dataType: AttributeDataType.DATE,
      isRequired: false,
      isMultiple: false,
      options: [],
    },
    {
      id: 'd6-uuid',
      key: 'notes',
      label: 'Примечания',
      dataType: AttributeDataType.TEXT,
      isRequired: false,
      isMultiple: false,
      options: [],
    },
    {
      id: 'd7-uuid',
      key: 'long_desc',
      label: 'Подробное описание',
      dataType: AttributeDataType.LONG_TEXT,
      isRequired: false,
      isMultiple: false,
      options: [],
    },
    {
      id: 'd8-uuid',
      key: 'datasheet_url',
      label: 'Документация',
      dataType: AttributeDataType.FILE,
      isRequired: false,
      isMultiple: false,
      options: [],
    },
    {
      id: 'd9-uuid',
      key: 'unit_price',
      label: 'Цена',
      dataType: AttributeDataType.MONEY,
      isRequired: false,
      isMultiple: false,
      options: [],
    },
    {
      id: 'd10-uuid',
      key: 'replacement_part',
      label: 'Аналог',
      dataType: AttributeDataType.REFERENCE,
      isRequired: false,
      isMultiple: false,
      options: [],
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributesValidationService,
        {
          provide: getRepositoryToken(AttributeDefinition),
          useValue: {
            find: jest.fn().mockResolvedValue(mockDefinitions),
          },
        },
        {
          provide: getRepositoryToken(AttributeOption),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<AttributesValidationService>(
      AttributesValidationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Required attributes validation', () => {
    it('should throw an error when required attribute is missing in full creation', async () => {
      await expect(
        service.validateAttributes([{ key: 'notes', value: 'Hello' }], false),
      ).rejects.toThrow(AttributeValidationException);
    });

    it('should NOT throw an error when required attribute is missing in partial update', async () => {
      const result = await service.validateAttributes(
        [{ key: 'notes', value: 'Hello' }],
        true,
      );
      expect(result).toHaveLength(1);
      expect(result[0].definition.key).toBe('notes');
      expect(result[0].items[0].value_string).toBe('Hello');
    });

    it('should throw when required attribute is set to empty string or null', async () => {
      await expect(
        service.validateAttributes(
          [{ key: 'nominal_voltage', value: '' }],
          false,
        ),
      ).rejects.toThrow(AttributeValidationException);
    });
  });

  describe('Data type validation: NUMBER and MONEY', () => {
    it('should accept valid numbers and numeric strings', async () => {
      const result = await service.validateAttributes([
        { key: 'nominal_voltage', value: 12.5 },
        { key: 'unit_price', value: '150.75' },
      ]);

      expect(result).toHaveLength(2);
      const voltage = result.find(
        (r) => r.definition.key === 'nominal_voltage',
      );
      expect(voltage?.items[0].value_number).toBe(12.5);

      const price = result.find((r) => r.definition.key === 'unit_price');
      expect(price?.items[0].value_number).toBe(150.75);
    });

    it('should reject non-numeric strings or NaN', async () => {
      await expect(
        service.validateAttributes([
          { key: 'nominal_voltage', value: 'invalid_number' },
        ]),
      ).rejects.toThrow(AttributeValidationException);
    });
  });

  describe('Data type validation: BOOLEAN', () => {
    it('should accept boolean and boolean-like values', async () => {
      const result = await service.validateAttributes(
        [
          { key: 'nominal_voltage', value: 5 },
          { key: 'is_rohs', value: 'true' },
        ],
        false,
      );

      const rohs = result.find((r) => r.definition.key === 'is_rohs');
      expect(rohs?.items[0].value_boolean).toBe(true);
    });

    it('should reject invalid boolean representations', async () => {
      await expect(
        service.validateAttributes([
          { key: 'nominal_voltage', value: 5 },
          { key: 'is_rohs', value: 'maybe' },
        ]),
      ).rejects.toThrow(AttributeValidationException);
    });
  });

  describe('Data type validation: DATE', () => {
    it('should accept valid ISO dates', async () => {
      const iso = '2026-09-24T12:00:00.000Z';
      const result = await service.validateAttributes([
        { key: 'nominal_voltage', value: 5 },
        { key: 'manufacture_date', value: iso },
      ]);

      const dateRecord = result.find(
        (r) => r.definition.key === 'manufacture_date',
      );
      expect(dateRecord?.items[0].value_date).toBeInstanceOf(Date);
      expect(dateRecord?.items[0].value_date?.toISOString()).toBe(iso);
    });

    it('should reject invalid date strings', async () => {
      await expect(
        service.validateAttributes([
          { key: 'nominal_voltage', value: 5 },
          { key: 'manufacture_date', value: 'not-a-date' },
        ]),
      ).rejects.toThrow(AttributeValidationException);
    });
  });

  describe('Data type validation: ENUM and MULTI_ENUM', () => {
    it('should accept valid option value or option ID for ENUM', async () => {
      const result = await service.validateAttributes([
        { key: 'nominal_voltage', value: 5 },
        { key: 'package_type', value: 'smd_0805' },
      ]);

      const pkg = result.find((r) => r.definition.key === 'package_type');
      expect(pkg?.items[0].value_option_id).toBe('opt1-uuid');
      expect(pkg?.items[0].option_value).toBe('smd_0805');
      expect(pkg?.items[0].option_label).toBe('SMD 0805');
    });

    it('should reject unknown option for ENUM', async () => {
      await expect(
        service.validateAttributes([
          { key: 'nominal_voltage', value: 5 },
          { key: 'package_type', value: 'sot_23' },
        ]),
      ).rejects.toThrow(AttributeValidationException);
    });

    it('should accept array of valid options for MULTI_ENUM', async () => {
      const result = await service.validateAttributes([
        { key: 'nominal_voltage', value: 5 },
        { key: 'certifications', value: ['iso9001', 'aec_q200'] },
      ]);

      const certs = result.find((r) => r.definition.key === 'certifications');
      expect(certs?.items).toHaveLength(2);
      expect(certs?.items[0].option_value).toBe('iso9001');
      expect(certs?.items[1].option_value).toBe('aec_q200');
    });

    it('should reject if any option in MULTI_ENUM is invalid', async () => {
      await expect(
        service.validateAttributes([
          { key: 'nominal_voltage', value: 5 },
          { key: 'certifications', value: ['iso9001', 'invalid_cert'] },
        ]),
      ).rejects.toThrow(AttributeValidationException);
    });
  });

  describe('Data type validation: REFERENCE', () => {
    it('should accept valid UUID', async () => {
      const uuid = '7b8f9e10-1234-4567-89ab-cdef01234567';
      const result = await service.validateAttributes([
        { key: 'nominal_voltage', value: 5 },
        { key: 'replacement_part', value: uuid },
      ]);

      const ref = result.find((r) => r.definition.key === 'replacement_part');
      expect(ref?.items[0].value_reference_id).toBe(uuid);
    });

    it('should reject invalid UUID', async () => {
      await expect(
        service.validateAttributes([
          { key: 'nominal_voltage', value: 5 },
          { key: 'replacement_part', value: 'not-a-valid-uuid' },
        ]),
      ).rejects.toThrow(AttributeValidationException);
    });
  });

  describe('Multiple values constraint (isMultiple)', () => {
    it('should reject array for non-multiple attribute', async () => {
      await expect(
        service.validateAttributes([
          { key: 'nominal_voltage', value: [5, 12] },
        ]),
      ).rejects.toThrow(AttributeValidationException);
    });
  });

  describe('Unknown attribute key', () => {
    it('should throw error with details when definition does not exist', async () => {
      await expect(
        service.validateAttributes([
          { key: 'non_existent_key', value: 'test' },
        ]),
      ).rejects.toThrow(AttributeValidationException);
    });
  });
});
