import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TypeOrmExceptionFilter } from '../src/common/filters/typeorm-exception.filter';
import { UnitGroup } from '../src/modules/units/enums/unit-group.enum';
import { AttributeDataType } from '../src/modules/attributes/enums/attribute-data-type.enum';
import { Unit } from '../src/modules/units/entities/unit.entity';
import { Category } from '../src/modules/categories/entities/category.entity';
import { Tag } from '../src/modules/tags/entities/tag.entity';
import { AttributeDefinition } from '../src/modules/attributes/entities/attribute-definition.entity';
import { Part } from '../src/modules/parts/entities/part.entity';
import { CategoryTreeDto } from '../src/modules/categories/dto/category-tree.dto';
import { CategoryDetailResponseDto } from '../src/modules/categories/dto/category-response.dto';
import { PartCardResponseDto } from '../src/modules/parts/dto/part-card-response.dto';
import { PaginatedResponseDto } from '../src/common/dto/paginated-response.dto';

describe('Electronic Warehouse (shelf-api) Complete E2E Suite', () => {
  let app: INestApplication<App>;
  let agent: request.Agent;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new TypeOrmExceptionFilter());
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
    await app.listen(0);
    const serverUrl = await app.getUrl();
    agent = request.agent(serverUrl);
    const dataSource = app.get(DataSource);
    await dataSource.query(
      'TRUNCATE stock_movements, attribute_value_history, actors, parts, attribute_values, attribute_definitions, attribute_options, categories, tags, units, part_tags CASCADE;',
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // Test state variables
  let voltUnitId: string;
  let ohmUnitId: string;

  let passivesCatId: string;
  let resistorsCatId: string;
  let smdResistorsCatId: string;

  let tagSmdId: string;
  let tagInStockId: string;

  let part1Id: string;
  let part2Id: string;
  let part3Id: string;

  // -------------------------------------------------------------
  // 1. UNITS MODULE E2E
  // -------------------------------------------------------------
  describe('1. Units Module', () => {
    it('POST /api/v1/units - should create Voltage unit', async () => {
      const res = await agent.post('/api/v1/units').send({
        name: 'Вольт',
        symbol: 'В',
        group: UnitGroup.ELECTRICAL,
      });

      expect(res.status).toBe(201);
      const unit = res.body as Unit;
      expect(unit.id).toBeDefined();
      expect(unit.symbol).toBe('В');
      voltUnitId = unit.id;
    });

    it('POST /api/v1/units - should create Ohm unit', async () => {
      const res = await agent.post('/api/v1/units').send({
        name: 'Ом',
        symbol: 'Ом',
        group: UnitGroup.ELECTRICAL,
      });

      expect(res.status).toBe(201);
      const unit = res.body as Unit;
      ohmUnitId = unit.id;
    });

    it('GET /api/v1/units - should list units with group filter', async () => {
      const res = await agent
        .get('/api/v1/units')
        .query({ group: UnitGroup.ELECTRICAL });

      expect(res.status).toBe(200);
      const units = res.body as Unit[];
      expect(Array.isArray(units)).toBe(true);
      expect(units.some((u) => u.id === voltUnitId)).toBe(true);
    });

    it('PATCH /api/v1/units/:id - should update unit name', async () => {
      const res = await agent
        .patch(`/api/v1/units/${ohmUnitId}`)
        .send({ name: 'Килоом', symbol: 'кОм' });

      expect(res.status).toBe(200);
      const unit = res.body as Unit;
      expect(unit.name).toBe('Килоом');
      expect(unit.symbol).toBe('кОм');
    });
  });

  // -------------------------------------------------------------
  // 2. CATEGORIES MODULE E2E
  // -------------------------------------------------------------
  describe('2. Categories Module', () => {
    it('POST /api/v1/categories - should create root category', async () => {
      const res = await agent.post('/api/v1/categories').send({
        name: 'Пассивные компоненты',
        code: 'passives',
      });

      expect(res.status).toBe(201);
      const category = res.body as Category;
      passivesCatId = category.id;
    });

    it('POST /api/v1/categories - should create subcategory', async () => {
      const res = await agent.post('/api/v1/categories').send({
        name: 'Резисторы',
        code: 'resistors',
        parentId: passivesCatId,
      });

      expect(res.status).toBe(201);
      const category = res.body as Category;
      resistorsCatId = category.id;
    });

    it('POST /api/v1/categories - should create leaf subcategory', async () => {
      const res = await agent.post('/api/v1/categories').send({
        name: 'Резисторы SMD',
        code: 'resistors_smd',
        parentId: resistorsCatId,
      });

      expect(res.status).toBe(201);
      const category = res.body as Category;
      smdResistorsCatId = category.id;
    });

    it('GET /api/v1/categories/tree - should return hierarchical category tree', async () => {
      const res = await agent.get('/api/v1/categories/tree');

      expect(res.status).toBe(200);
      const tree = res.body as CategoryTreeDto[];
      expect(Array.isArray(tree)).toBe(true);

      const passivesNode = tree.find((n) => n.id === passivesCatId);
      expect(passivesNode).toBeDefined();
      expect(passivesNode?.children.length).toBeGreaterThanOrEqual(1);

      const resistorsNode = passivesNode?.children.find(
        (n) => n.id === resistorsCatId,
      );
      expect(resistorsNode).toBeDefined();
      expect(resistorsNode?.children.length).toBeGreaterThanOrEqual(1);
      expect(resistorsNode?.children[0].id).toBe(smdResistorsCatId);
    });

    it('GET /api/v1/categories/:id - should return category with breadcrumbs', async () => {
      const res = await agent.get(`/api/v1/categories/${smdResistorsCatId}`);

      expect(res.status).toBe(200);
      const detail = res.body as CategoryDetailResponseDto;
      expect(detail.id).toBe(smdResistorsCatId);
      expect(detail.breadcrumbs).toBeDefined();
      expect(detail.breadcrumbs.length).toBe(3);
      expect(detail.breadcrumbs[0].id).toBe(passivesCatId);
      expect(detail.breadcrumbs[1].id).toBe(resistorsCatId);
      expect(detail.breadcrumbs[2].id).toBe(smdResistorsCatId);
    });

    it('PATCH /api/v1/categories/:id - should reject cycle in hierarchy', async () => {
      const res = await agent
        .patch(`/api/v1/categories/${passivesCatId}`)
        .send({ parentId: smdResistorsCatId });

      expect(res.status).toBe(400);
    });

    it('DELETE /api/v1/categories/:id - should reject deletion when category has children', async () => {
      const res = await agent.delete(`/api/v1/categories/${passivesCatId}`);

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------
  // 3. TAGS MODULE E2E
  // -------------------------------------------------------------
  describe('3. Tags Module', () => {
    it('POST /api/v1/tags - should create tags', async () => {
      const res1 = await agent
        .post('/api/v1/tags')
        .send({ name: 'SMD', color: '#3B82F6' });
      expect(res1.status).toBe(201);
      const tag1 = res1.body as Tag;
      tagSmdId = tag1.id;

      const res2 = await agent
        .post('/api/v1/tags')
        .send({ name: 'В наличии', color: '#10B981' });
      expect(res2.status).toBe(201);
      const tag2 = res2.body as Tag;
      tagInStockId = tag2.id;

      const res3 = await agent
        .post('/api/v1/tags')
        .send({ name: 'Резерв', color: '#EF4444' });
      expect(res3.status).toBe(201);
    });

    it('POST /api/v1/tags - should reject duplicate tag case-insensitively', async () => {
      const res = await agent
        .post('/api/v1/tags')
        .send({ name: 'smd', color: '#000000' });

      expect(res.status).toBe(409);
    });

    it('GET /api/v1/tags - should filter tags by search prefix', async () => {
      const res = await agent.get('/api/v1/tags').query({ search: 'налич' });

      expect(res.status).toBe(200);
      const tags = res.body as Tag[];
      expect(tags.length).toBe(1);
      expect(tags[0].id).toBe(tagInStockId);
    });
  });

  // -------------------------------------------------------------
  // 4. ATTRIBUTES DEFINITIONS E2E
  // -------------------------------------------------------------
  describe('4. Dynamic Attributes Module', () => {
    it('POST /api/v1/attributes/definitions - should create number attribute with unit', async () => {
      const res = await agent.post('/api/v1/attributes/definitions').send({
        key: 'nominal_voltage',
        label: 'Номинальное напряжение',
        dataType: AttributeDataType.NUMBER,
        unitId: voltUnitId,
        isRequired: false,
        isMultiple: false,
      });

      expect(res.status).toBe(201);
      const def = res.body as AttributeDefinition;
      expect(def.key).toBe('nominal_voltage');
    });

    it('POST /api/v1/attributes/definitions - should create resistance attribute', async () => {
      const res = await agent.post('/api/v1/attributes/definitions').send({
        key: 'resistance',
        label: 'Сопротивление',
        dataType: AttributeDataType.NUMBER,
        unitId: ohmUnitId,
        isRequired: false,
        isMultiple: false,
      });

      expect(res.status).toBe(201);
    });

    it('POST /api/v1/attributes/definitions - should create enum attribute with options', async () => {
      const res = await agent.post('/api/v1/attributes/definitions').send({
        key: 'package_type',
        label: 'Тип корпуса',
        dataType: AttributeDataType.ENUM,
        isRequired: false,
        isMultiple: false,
        options: [
          { value: 'smd_0805', label: 'SMD 0805', sortOrder: 1 },
          { value: 'smd_1206', label: 'SMD 1206', sortOrder: 2 },
        ],
      });

      expect(res.status).toBe(201);
      const def = res.body as AttributeDefinition;
      expect(def.options?.length).toBe(2);
    });

    it('POST /api/v1/attributes/definitions - should create boolean attribute', async () => {
      const res = await agent.post('/api/v1/attributes/definitions').send({
        key: 'is_rohs',
        label: 'Соответствие RoHS',
        dataType: AttributeDataType.BOOLEAN,
        isRequired: false,
      });

      expect(res.status).toBe(201);
    });

    it('POST /api/v1/attributes/definitions - should create multi_enum attribute', async () => {
      const res = await agent.post('/api/v1/attributes/definitions').send({
        key: 'certifications',
        label: 'Сертификаты',
        dataType: AttributeDataType.MULTI_ENUM,
        isRequired: false,
        isMultiple: true,
        options: [
          { value: 'iso9001', label: 'ISO-9001' },
          { value: 'aec_q200', label: 'AEC-Q200' },
        ],
      });

      expect(res.status).toBe(201);
    });
  });

  // -------------------------------------------------------------
  // 5. PARTS CORE & DYNAMIC EAV & FILTERING E2E
  // -------------------------------------------------------------
  describe('5. Parts Module Core & Filtering', () => {
    it('POST /api/v1/parts - should create Part 1 with full attributes and tags', async () => {
      const res = await agent.post('/api/v1/parts').send({
        name: 'Резистор SMD 10 кОм 0805 1%',
        sku: 'RES-0805-10K-F',
        description: 'Высокоточный чип-резистор',
        categoryId: smdResistorsCatId,
        tagIds: [tagSmdId, tagInStockId],
        attributes: [
          { key: 'nominal_voltage', value: 12.0 },
          { key: 'resistance', value: 10.0 },
          { key: 'package_type', value: 'smd_0805' },
          { key: 'is_rohs', value: true },
          { key: 'certifications', value: ['iso9001', 'aec_q200'] },
        ],
      });

      expect(res.status).toBe(201);
      const part = res.body as Part;
      expect(part.id).toBeDefined();
      expect(part.sku).toBe('RES-0805-10K-F');
      expect(part.attributesSnapshot).toBeDefined();
      expect(part.attributesSnapshot.nominal_voltage).toBe(12.0);
      expect(part.attributesSnapshot.package_type).toBe('smd_0805');
      expect(part.attributesSnapshot.certifications).toEqual([
        'iso9001',
        'aec_q200',
      ]);

      part1Id = part.id;
    });

    it('POST /api/v1/parts - should create Part 2 with only SMD tag and 5V', async () => {
      const res = await agent.post('/api/v1/parts').send({
        name: 'Резистор SMD 1 кОм 1206',
        sku: 'RES-1206-1K-J',
        categoryId: smdResistorsCatId,
        tagIds: [tagSmdId],
        attributes: [
          { key: 'nominal_voltage', value: 5.0 },
          { key: 'resistance', value: 1.0 },
          { key: 'package_type', value: 'smd_1206' },
          { key: 'is_rohs', value: false },
        ],
      });

      expect(res.status).toBe(201);
      const part = res.body as Part;
      part2Id = part.id;
    });

    it('POST /api/v1/parts - should create Part 3 with InStock tag only', async () => {
      const res = await agent.post('/api/v1/parts').send({
        name: 'Резистор SMD 100 кОм 0805',
        sku: 'RES-0805-100K',
        categoryId: smdResistorsCatId,
        tagIds: [tagInStockId],
        attributes: [
          { key: 'nominal_voltage', value: 24.0 },
          { key: 'resistance', value: 100.0 },
          { key: 'package_type', value: 'smd_0805' },
          { key: 'is_rohs', value: true },
        ],
      });

      expect(res.status).toBe(201);
      const part = res.body as Part;
      part3Id = part.id;
    });

    it('GET /api/v1/parts/:id/card - should return full enriched part card with breadcrumbs, units, and option labels', async () => {
      const res = await agent.get(`/api/v1/parts/${part1Id}/card`);

      expect(res.status).toBe(200);
      const card = res.body as PartCardResponseDto;
      expect(card.id).toBe(part1Id);
      expect(card.category?.breadcrumbs.length).toBe(3);
      expect(card.tags.length).toBe(2);

      const attrs = card.attributes;
      const voltage = attrs.find((a) => a.key === 'nominal_voltage');
      expect(voltage).toBeDefined();
      expect(voltage?.formattedValue).toBe('12 В');

      const resistance = attrs.find((a) => a.key === 'resistance');
      expect(resistance).toBeDefined();
      expect(resistance?.formattedValue).toBe('10 кОм');

      const pkg = attrs.find((a) => a.key === 'package_type');
      expect(pkg).toBeDefined();
      expect(pkg?.formattedValue).toBe('SMD 0805');
      expect(pkg?.option?.value).toBe('smd_0805');

      const rohs = attrs.find((a) => a.key === 'is_rohs');
      expect(rohs).toBeDefined();
      expect(rohs?.formattedValue).toBe('Да');

      const certs = attrs.find((a) => a.key === 'certifications');
      expect(certs).toBeDefined();
      expect(certs?.formattedValue).toBe('ISO-9001, AEC-Q200');
    });

    it('GET /api/v1/parts (AND-tags filter) - should return ONLY Part 1 when filtering by [SMD, InStock]', async () => {
      const res = await agent
        .get('/api/v1/parts')
        .query({ tagIds: `${tagSmdId},${tagInStockId}` });

      expect(res.status).toBe(200);
      const body = res.body as PaginatedResponseDto<Part>;
      expect(body.data.length).toBe(1);
      expect(body.data[0].id).toBe(part1Id);
    });

    it('GET /api/v1/parts (Dynamic attribute filter) - should filter by numeric range [5, 15]', async () => {
      const res = await agent.get('/api/v1/parts').query({
        'attr[nominal_voltage][gte]': 5,
        'attr[nominal_voltage][lte]': 15,
      });

      expect(res.status).toBe(200);
      const body = res.body as PaginatedResponseDto<Part>;
      const ids = body.data.map((p) => p.id);
      expect(ids).toContain(part1Id); // 12V
      expect(ids).toContain(part2Id); // 5V
      expect(ids).not.toContain(part3Id); // 24V
    });

    it('GET /api/v1/parts (Category recursive filter) - should find parts under parent category', async () => {
      const res = await agent.get('/api/v1/parts').query({
        categoryId: passivesCatId,
        includeSubcategories: true,
      });

      expect(res.status).toBe(200);
      const body = res.body as PaginatedResponseDto<Part>;
      expect(body.data.length).toBeGreaterThanOrEqual(3);
    });
  });

  // -------------------------------------------------------------
  // 6. ZERO-MIGRATION & ACCEPTANCE SCENARIOS
  // -------------------------------------------------------------
  describe('6. Zero-Migration & System Invariants Acceptance', () => {
    it('Scenario 1: Zero-migration dynamic field addition without schema alter', async () => {
      // 1. Existing parts exist (part1, part2, part3)
      // 2. Add brand new attribute definition via API
      const defRes = await agent.post('/api/v1/attributes/definitions').send({
        key: 'tolerance',
        label: 'Погрешность',
        dataType: AttributeDataType.ENUM,
        options: [
          { value: '0.1%', label: '±0.1%' },
          { value: '1%', label: '±1%' },
          { value: '5%', label: '±5%' },
        ],
      });

      expect(defRes.status).toBe(201);

      // 3. Existing parts still read seamlessly
      const readRes = await agent.get(`/api/v1/parts/${part1Id}`);
      expect(readRes.status).toBe(200);

      // 4. Update Part 1 with new attribute
      const updateRes = await agent.patch(`/api/v1/parts/${part1Id}`).send({
        attributes: [{ key: 'tolerance', value: '1%' }],
      });

      expect(updateRes.status).toBe(200);
      const updatedPart = updateRes.body as Part;
      expect(updatedPart.attributesSnapshot.tolerance).toBe('1%');

      // 5. Query parts by newly added dynamic attribute
      const filterRes = await agent
        .get('/api/v1/parts')
        .query({ 'attr[tolerance]': '1%' });

      expect(filterRes.status).toBe(200);
      const filterBody = filterRes.body as PaginatedResponseDto<Part>;
      expect(filterBody.data.length).toBe(1);
      expect(filterBody.data[0].id).toBe(part1Id);
    });

    it('Scenario 2: Validation rejection on invalid attribute values', async () => {
      // Try to create part with invalid number and invalid option
      const res = await agent.post('/api/v1/parts').send({
        name: 'Invalid Part',
        sku: 'INV-001',
        attributes: [
          { key: 'nominal_voltage', value: 'not_a_number' },
          { key: 'package_type', value: 'unknown_package_type' },
        ],
      });

      expect(res.status).toBe(422);
      const body = res.body as { error: string; details: unknown[] };
      expect(body.error).toBe('Attribute Validation Failed');
      expect(body.details.length).toBe(2);
    });

    it('Scenario 3: Cascade deletion of part and its EAV attribute values', async () => {
      const deleteRes = await agent.delete(`/api/v1/parts/${part3Id}`);
      expect(deleteRes.status).toBe(204);

      const findRes = await agent.get(`/api/v1/parts/${part3Id}`);
      expect(findRes.status).toBe(404);
    });
  });
});
