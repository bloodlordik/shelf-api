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
import { StockMovementType } from '../src/modules/stock/enums/stock-movement-type.enum';
import { AttributeChangeType } from '../src/modules/attributes/enums/attribute-change-type.enum';
import { StockMovementsService } from '../src/modules/stock/services/stock-movements.service';
import { Unit } from '../src/modules/units/entities/unit.entity';
import { AttributeDefinition } from '../src/modules/attributes/entities/attribute-definition.entity';
import { Part } from '../src/modules/parts/entities/part.entity';
import { StockMovementResponseDto } from '../src/modules/stock/dto/stock-movement-response.dto';
import { AttributeValueHistoryResponseDto } from '../src/modules/attributes/dto/attribute-value-history-response.dto';
import { PartCardResponseDto } from '../src/modules/parts/dto/part-card-response.dto';
import { PaginatedResponseDto } from '../src/common/dto/paginated-response.dto';

describe('Change History (Stock Movements & Attribute History) E2E Suite', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let agent: request.Agent;

  let voltUnitId: string;
  let voltageDefId: string;
  let testPartId: string;

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
    dataSource = app.get(DataSource);
    await dataSource.query(
      'TRUNCATE stock_movements, attribute_value_history, actors, parts, attribute_values, attribute_definitions, attribute_options, categories, tags, units, part_tags CASCADE;',
    );

    // Setup basic Unit
    const unitRes = await agent.post('/api/v1/units').send({
      name: 'Вольт',
      symbol: 'В',
      group: UnitGroup.ELECTRICAL,
    });
    voltUnitId = (unitRes.body as Unit).id;

    // Setup Attribute Definition: Voltage
    const voltDefRes = await agent.post('/api/v1/attributes/definitions').send({
      key: 'nominal_voltage',
      label: 'Номинальное напряжение',
      dataType: AttributeDataType.NUMBER,
      unitId: voltUnitId,
    });
    voltageDefId = (voltDefRes.body as AttributeDefinition).id;

    // Setup Attribute Definition: Package Type (Enum)
    const pkgDefRes = await agent.post('/api/v1/attributes/definitions').send({
      key: 'package_type',
      label: 'Тип корпуса',
      dataType: AttributeDataType.ENUM,
      options: [
        { value: 'smd_0805', label: 'SMD 0805' },
        { value: 'smd_1206', label: 'SMD 1206' },
      ],
    });
    expect(pkgDefRes.status).toBe(201);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // -------------------------------------------------------------
  // 1. REGRESSION DEFENSE: DIRECT QUANTITY MODIFICATION ATTEMPTS
  // -------------------------------------------------------------
  describe('1. Regression Defense & Initial Part State', () => {
    it('POST /api/v1/parts with direct quantity should ignore quantity and initialize with 0', async () => {
      const res = await agent.post('/api/v1/parts').send({
        name: 'Резистор 10 кОм',
        sku: 'RES-0805-10K',
        quantity: 999, // Should be ignored / default to 0
        actorId: 5,
        attributes: [{ key: 'nominal_voltage', value: 12.0 }],
      });

      expect(res.status).toBe(201);
      const part = res.body as Part;
      expect(part.id).toBeDefined();
      expect(part.quantity).toBe(0);
      testPartId = part.id;
    });

    it('PATCH /api/v1/parts/:id with direct quantity should ignore quantity update', async () => {
      const res = await agent.patch(`/api/v1/parts/${testPartId}`).send({
        name: 'Резистор 10 кОм SMD',
        quantity: 500, // Should be ignored
      });

      expect(res.status).toBe(200);
      const part = res.body as Part;
      expect(part.name).toBe('Резистор 10 кОм SMD');
      expect(part.quantity).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // 2. STOCK MOVEMENTS ENGINE & AUTO ACTOR CREATION
  // -------------------------------------------------------------
  describe('2. Stock Movements Engine & Business Rules', () => {
    it('POST /api/v1/parts/:id/movements - should reject missing actorId or invalid actorId', async () => {
      const res1 = await agent
        .post(`/api/v1/parts/${testPartId}/movements`)
        .send({
          type: StockMovementType.RECEIPT,
          quantity: 100,
          referenceDoc: 'ТТН-1',
        });
      expect(res1.status).toBe(400);

      const res2 = await agent
        .post(`/api/v1/parts/${testPartId}/movements`)
        .send({
          actorId: -5,
          type: StockMovementType.RECEIPT,
          quantity: 100,
          referenceDoc: 'ТТН-1',
        });
      expect(res2.status).toBe(400);
    });

    it('POST /api/v1/parts/:id/movements - receipt (+100, actorId: 101) creates actor and sets quantity to 100', async () => {
      const res = await agent
        .post(`/api/v1/parts/${testPartId}/movements`)
        .send({
          actorId: 101,
          type: StockMovementType.RECEIPT,
          quantity: 100,
          referenceDoc: 'ТТН-2026-001',
          reason: 'Поступление от поставщика',
        });

      expect(res.status).toBe(201);
      const movement = res.body as StockMovementResponseDto;
      expect(movement.id).toBeDefined();
      expect(movement.partId).toBe(testPartId);
      expect(movement.movementType).toBe(StockMovementType.RECEIPT);
      expect(movement.quantityDelta).toBe(100);
      expect(movement.quantityAfter).toBe(100);
      expect(movement.performedBy).toBe(101);

      // Verify actor exists in DB
      const actorRow: Array<{ id: number }> = await dataSource.query(
        'SELECT * FROM actors WHERE id = 101;',
      );
      expect(actorRow.length).toBe(1);
      expect(actorRow[0].id).toBe(101);

      // Verify part quantity updated
      const partRes = await agent.get(`/api/v1/parts/${testPartId}`);
      expect((partRes.body as Part).quantity).toBe(100);
    });

    it('POST /api/v1/parts/:id/movements - receipt without referenceDoc and reason should succeed (201)', async () => {
      const partRes = await agent.post('/api/v1/parts').send({
        sku: 'OPT-FLD-001',
        name: 'Optional Fields Part',
      });
      const optPartId = (partRes.body as Part).id;

      const res = await agent
        .post(`/api/v1/parts/${optPartId}/movements`)
        .send({
          actorId: 199,
          type: StockMovementType.RECEIPT,
          quantity: 50,
        });

      expect(res.status).toBe(201);
      const movement = res.body as StockMovementResponseDto;
      expect(movement.referenceDoc).toBeNull();
      expect(movement.reason).toBeNull();
      expect(movement.quantityAfter).toBe(50);
    });
    it('POST /api/v1/parts/:id/movements - writeoff (-30, actorId: 102) updates quantity to 70', async () => {
      const res = await agent
        .post(`/api/v1/parts/${testPartId}/movements`)
        .send({
          actorId: 102,
          type: StockMovementType.WRITEOFF,
          quantity: 30,
          reason: 'Брак при пайке',
        });

      expect(res.status).toBe(201);
      const movement = res.body as StockMovementResponseDto;
      expect(movement.quantityDelta).toBe(-30);
      expect(movement.quantityAfter).toBe(70);
      expect(movement.performedBy).toBe(102);

      const partRes = await agent.get(`/api/v1/parts/${testPartId}`);
      expect((partRes.body as Part).quantity).toBe(70);
    });

    it('POST /api/v1/parts/:id/movements - writeoff without reason should succeed (201)', async () => {
      const partRes = await agent.get('/api/v1/parts?search=OPT-FLD-001');
      const paginated = partRes.body as PaginatedResponseDto<Part>;
      const optPartId = paginated.data[0].id;
      const res = await agent
        .post(`/api/v1/parts/${optPartId}/movements`)
        .send({
          actorId: 198,
          type: StockMovementType.WRITEOFF,
          quantity: 10,
        });

      expect(res.status).toBe(201);
      const movement = res.body as StockMovementResponseDto;
      expect(movement.reason).toBeNull();
      expect(movement.referenceDoc).toBeNull();
      expect(movement.quantityAfter).toBe(40);
    });
    it('POST /api/v1/parts/:id/movements - correction (target: 85, actorId: 101) sets quantity to 85 (delta: +15)', async () => {
      const res = await agent
        .post(`/api/v1/parts/${testPartId}/movements`)
        .send({
          actorId: 101,
          type: StockMovementType.CORRECTION,
          targetQuantity: 85,
          reason: 'Акт инвентаризации №10',
        });

      expect(res.status).toBe(201);
      const movement = res.body as StockMovementResponseDto;
      expect(movement.quantityDelta).toBe(15);
      expect(movement.quantityAfter).toBe(85);

      const partRes = await agent.get(`/api/v1/parts/${testPartId}`);
      expect((partRes.body as Part).quantity).toBe(85);
    });

    it('POST /api/v1/parts/:id/movements - correction with 0 delta should be rejected (400)', async () => {
      const res = await agent
        .post(`/api/v1/parts/${testPartId}/movements`)
        .send({
          actorId: 101,
          type: StockMovementType.CORRECTION,
          targetQuantity: 85,
          reason: 'Повторный акт инвентаризации',
        });

      expect(res.status).toBe(400);
    });

    it('POST /api/v1/parts/:id/movements - writeoff exceeding stock (requested: 90, available: 85) should be rejected (400)', async () => {
      const res = await agent
        .post(`/api/v1/parts/${testPartId}/movements`)
        .send({
          actorId: 103,
          type: StockMovementType.WRITEOFF,
          quantity: 90,
          reason: 'Списание на производство',
        });

      expect(res.status).toBe(400);

      // Verify stock remained unchanged at 85
      const partRes = await agent.get(`/api/v1/parts/${testPartId}`);
      expect((partRes.body as Part).quantity).toBe(85);
    });

    it('POST /api/v1/parts/:id/movements - transfer_out (-15) and transfer_in (+10)', async () => {
      const outRes = await agent
        .post(`/api/v1/parts/${testPartId}/movements`)
        .send({
          actorId: 104,
          type: StockMovementType.TRANSFER_OUT,
          quantity: 15,
          reason: 'Перемещение в лабораторию',
        });
      expect(outRes.status).toBe(201);
      expect((outRes.body as StockMovementResponseDto).quantityAfter).toBe(70);

      const inRes = await agent
        .post(`/api/v1/parts/${testPartId}/movements`)
        .send({
          actorId: 104,
          type: StockMovementType.TRANSFER_IN,
          quantity: 10,
          referenceDoc: 'Возврат из лаборатории №2',
        });
      expect(inRes.status).toBe(201);
      expect((inRes.body as StockMovementResponseDto).quantityAfter).toBe(80);

      const partRes = await agent.get(`/api/v1/parts/${testPartId}`);
      expect((partRes.body as Part).quantity).toBe(80);
    });

    it('GET /api/v1/parts/:id/movements - should return filtered paginated movements', async () => {
      const res = await agent
        .get(`/api/v1/parts/${testPartId}/movements?page=1&limit=10`)
        .send();

      expect(res.status).toBe(200);
      const paginated =
        res.body as PaginatedResponseDto<StockMovementResponseDto>;
      expect(paginated.meta.total).toBe(5);
      expect(paginated.data.length).toBe(5);

      // Verify sum of deltas equals current quantity: 100 - 30 + 15 - 15 + 10 = 80
      const totalDelta = paginated.data.reduce(
        (sum, m) => sum + m.quantityDelta,
        0,
      );
      expect(totalDelta).toBe(80);
    });

    it('GET /api/v1/stock/movements - should return global movements journal', async () => {
      const res = await agent
        .get(`/api/v1/stock/movements?performedBy=101`)
        .send();

      expect(res.status).toBe(200);
      const paginated =
        res.body as PaginatedResponseDto<StockMovementResponseDto>;
      expect(paginated.meta.total).toBe(2); // receipt (100) and correction (15)
      expect(paginated.data.every((m) => m.performedBy === 101)).toBe(true);
    });

    it('GET /api/v1/parts/:id/card - should contain quantity and stockSummary', async () => {
      const res = await agent.get(`/api/v1/parts/${testPartId}/card`).send();

      expect(res.status).toBe(200);
      const card = res.body as PartCardResponseDto;
      expect(card.quantity).toBe(80);
      expect(card.stockSummary).toBeDefined();
      expect(card.stockSummary?.totalMovementsCount).toBe(5);
      expect(card.stockSummary?.lastMovementAt).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 3. ATTRIBUTE VALUE HISTORY ENGINE
  // -------------------------------------------------------------
  describe('3. Attribute Value History Engine & Audit Log', () => {
    it('Initial part creation with actorId=5 should have created CREATED history record', async () => {
      const res = await agent
        .get(`/api/v1/parts/${testPartId}/attributes/history`)
        .send();

      expect(res.status).toBe(200);
      const history =
        res.body as PaginatedResponseDto<AttributeValueHistoryResponseDto>;
      expect(history.meta.total).toBe(1);
      expect(history.data[0].changeType).toBe(AttributeChangeType.CREATED);
      expect(history.data[0].newValue).toBe(12.0);
      expect(history.data[0].changedBy).toBe(5);
    });

    it('PATCH /api/v1/parts/:id with changed attribute and actorId=7 should record UPDATED history', async () => {
      const res = await agent.patch(`/api/v1/parts/${testPartId}`).send({
        actorId: 7,
        attributes: [{ key: 'nominal_voltage', value: 24.0 }],
      });

      expect(res.status).toBe(200);

      const histRes = await agent
        .get(`/api/v1/parts/${testPartId}/attributes/history`)
        .send();

      const history =
        histRes.body as PaginatedResponseDto<AttributeValueHistoryResponseDto>;
      expect(history.meta.total).toBe(2);

      const latest = history.data[0];
      expect(latest.changeType).toBe(AttributeChangeType.UPDATED);
      expect(latest.oldValue).toBe(12.0);
      expect(latest.newValue).toBe(24.0);
      expect(latest.changedBy).toBe(7);
      expect(latest.oldValueFormatted).toBe('12 В');
      expect(latest.newValueFormatted).toBe('24 В');
    });

    it('PATCH /api/v1/parts/:id with identical attribute value should NOT create history record', async () => {
      const res = await agent.patch(`/api/v1/parts/${testPartId}`).send({
        actorId: 7,
        attributes: [{ key: 'nominal_voltage', value: 24.0 }],
      });

      expect(res.status).toBe(200);

      const histRes = await agent
        .get(`/api/v1/parts/${testPartId}/attributes/history`)
        .send();

      const history =
        histRes.body as PaginatedResponseDto<AttributeValueHistoryResponseDto>;
      expect(history.meta.total).toBe(2); // Still 2, no false positive!
    });

    it('PUT /api/v1/parts/:id/attributes with ReplacePartAttributesDto should log diffs', async () => {
      const res = await agent
        .put(`/api/v1/parts/${testPartId}/attributes`)
        .send({
          actorId: 8,
          attributes: [
            { key: 'package_type', value: 'smd_0805' },
            // voltage removed -> DELETED
          ],
        });

      expect(res.status).toBe(200);

      const histRes = await agent
        .get(`/api/v1/parts/${testPartId}/attributes/history`)
        .send();

      const history =
        histRes.body as PaginatedResponseDto<AttributeValueHistoryResponseDto>;
      expect(history.meta.total).toBe(4);

      const pkgCreated = history.data.find(
        (h) =>
          h.attributeKey === 'package_type' &&
          h.changeType === AttributeChangeType.CREATED,
      );
      expect(pkgCreated).toBeDefined();
      expect(pkgCreated?.newValue).toBe('smd_0805');
      expect(pkgCreated?.changedBy).toBe(8);

      const voltDeleted = history.data.find(
        (h) =>
          h.attributeKey === 'nominal_voltage' &&
          h.changeType === AttributeChangeType.DELETED,
      );
      expect(voltDeleted).toBeDefined();
      expect(voltDeleted?.oldValue).toBe(24.0);
      expect(voltDeleted?.newValue).toBeNull();
      expect(voltDeleted?.changedBy).toBe(8);
    });

    it('GET /api/v1/attributes/:id/history should return history by attribute definition', async () => {
      const res = await agent
        .get(`/api/v1/attributes/${voltageDefId}/history`)
        .send();

      expect(res.status).toBe(200);
      const history =
        res.body as PaginatedResponseDto<AttributeValueHistoryResponseDto>;
      expect(history.meta.total).toBe(3); // CREATED (12), UPDATED (24), DELETED
      expect(
        history.data.every((h) => h.attributeDefinitionId === voltageDefId),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 4. CONCURRENCY & TRANSACTION ISOLATION TEST
  // -------------------------------------------------------------
  describe('4. Concurrency & Pessimistic Locking', () => {
    it('10 concurrent writeoffs of 15 units on part with quantity=80: exactly 5 should succeed and 5 fail, leaving quantity=5', async () => {
      const stockService = app.get(StockMovementsService);

      const promises = Array.from({ length: 10 }).map(async (_, index) => {
        try {
          const movement = await stockService.applyMovement(testPartId, {
            actorId: 200 + index,
            type: StockMovementType.WRITEOFF,
            quantity: 15,
            reason: `Concurrent writeoff #${index}`,
          });
          return { status: 201, movement };
        } catch (err: unknown) {
          return { status: 400, error: err };
        }
      });

      const results = await Promise.all(promises);

      const succeeded = results.filter((r) => r.status === 201);
      const failed = results.filter((r) => r.status === 400);

      expect(succeeded.length).toBe(5); // 5 * 15 = 75 deducted from 80 -> remaining 5
      expect(failed.length).toBe(5); // 5 rejected due to insufficient stock

      const partRes = await agent.get(`/api/v1/parts/${testPartId}`);
      expect((partRes.body as Part).quantity).toBe(5);
    });
  });
});
