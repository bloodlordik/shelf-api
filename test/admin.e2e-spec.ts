import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AbstractLoader, ExpressLoader } from '@nestjs/serve-static';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TypeOrmExceptionFilter } from '../src/common/filters/typeorm-exception.filter';
import { UnitGroup } from '../src/modules/units/enums/unit-group.enum';
import { AttributeDataType } from '../src/modules/attributes/enums/attribute-data-type.enum';
import { StockMovementType } from '../src/modules/stock/enums/stock-movement-type.enum';
import { Unit } from '../src/modules/units/entities/unit.entity';
import { Category } from '../src/modules/categories/entities/category.entity';
import { Tag } from '../src/modules/tags/entities/tag.entity';
import { Part } from '../src/modules/parts/entities/part.entity';
import { PaginatedResponseDto } from '../src/common/dto/paginated-response.dto';
import { AdminStatsResponseDto } from '../src/modules/admin/dto/admin-stats.dto';

describe('Admin Dashboard Module (e2e)', () => {
  let app: INestApplication<App>;
  let serverUrl: string;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AbstractLoader)
      .useClass(ExpressLoader)
      .compile();

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
    app.setGlobalPrefix('api', {
      exclude: ['admin', 'admin/{*path}', 'health', 'health/{*path}'],
    });
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
    await app.listen(0);
    serverUrl = await app.getUrl();

    dataSource = app.get(DataSource);
    await dataSource.query(
      'TRUNCATE stock_movements, attribute_value_history, actors, parts, attribute_values, attribute_definitions, attribute_options, categories, tags, units, part_tags CASCADE;',
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /admin and SPA Fallbacks', () => {
    it('should serve Dashboard HTML on GET /admin with text/html content-type', async () => {
      const res = await request(serverUrl).get('/admin').redirects(1);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('<!DOCTYPE html>');
      expect(res.text).toContain('Shelf Admin');
      expect(res.text).toContain('renderOverview');
      expect(res.text).toContain('/api/v1');
    });

    it('should serve Dashboard HTML on SPA subroutes (e.g. /admin/parts)', async () => {
      const res = await request(serverUrl).get('/admin/parts');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('<!DOCTYPE html>');
      expect(res.text).toContain('Shelf Admin');
    });
  });

  describe('GET /admin/stats', () => {
    it('should return initial zero stats on empty warehouse', async () => {
      const res = await request(serverUrl).get('/admin/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        totalParts: 0,
        totalQuantity: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        categoriesCount: 0,
        tagsCount: 0,
        attributesCount: 0,
        unitsCount: 0,
        movementsCount: 0,
        recentMovements: [],
        lowStockParts: [],
      });
    });

    it('should accurately aggregate stats after entities and stock movements are added', async () => {
      // 1. Create Unit
      const unitRes = await request(serverUrl).post('/api/v1/units').send({
        symbol: 'кОм',
        name: 'Килоом',
        group: UnitGroup.ELECTRICAL,
      });
      expect(unitRes.status).toBe(201);
      const unit = unitRes.body as Unit;
      const unitId = unit.id;

      // 2. Create Category
      const catRes = await request(serverUrl).post('/api/v1/categories').send({
        name: 'Резисторы',
        code: 'resistors',
      });
      expect(catRes.status).toBe(201);
      const category = catRes.body as Category;
      const catId = category.id;

      // 3. Create Tag
      const tagRes = await request(serverUrl).post('/api/v1/tags').send({
        name: 'SMD',
        color: '#6366f1',
      });
      expect(tagRes.status).toBe(201);
      const tag = tagRes.body as Tag;
      const tagId = tag.id;

      // 4. Create Attribute Definition
      const attrRes = await request(serverUrl)
        .post('/api/v1/attributes/definitions')
        .send({
          key: 'nominal_resistance',
          label: 'Номинальное сопротивление',
          dataType: AttributeDataType.NUMBER,
          unitId,
          isRequired: true,
        });
      expect(attrRes.status).toBe(201);

      // 5. Create Part 1
      const part1Res = await request(serverUrl)
        .post('/api/v1/parts')
        .send({
          name: 'Резистор 10 кОм 0805',
          sku: 'RES-0805-10K',
          categoryId: catId,
          tagIds: [tagId],
          attributes: [{ key: 'nominal_resistance', value: 10 }],
        });
      expect(part1Res.status).toBe(201);
      const part1 = part1Res.body as Part;
      const part1Id = part1.id;

      // 6. Create Part 2
      const part2Res = await request(serverUrl)
        .post('/api/v1/parts')
        .send({
          name: 'Резистор 100 кОм 0805',
          sku: 'RES-0805-100K',
          categoryId: catId,
          tagIds: [tagId],
          attributes: [{ key: 'nominal_resistance', value: 100 }],
        });
      expect(part2Res.status).toBe(201);
      const part2 = part2Res.body as Part;
      const part2Id = part2.id;

      // 7. Apply stock movements
      const mov1 = await request(serverUrl)
        .post(`/api/v1/parts/${part1Id}/movements`)
        .send({
          actorId: 1,
          type: StockMovementType.RECEIPT,
          quantity: 50,
          referenceDoc: 'ТТН-101',
        });
      expect(mov1.status).toBe(201);

      const mov2 = await request(serverUrl)
        .post(`/api/v1/parts/${part2Id}/movements`)
        .send({
          actorId: 1,
          type: StockMovementType.RECEIPT,
          quantity: 3,
          referenceDoc: 'ТТН-102',
        });
      expect(mov2.status).toBe(201);

      // Check stats now
      const statsRes = await request(serverUrl).get('/admin/stats');
      expect(statsRes.status).toBe(200);
      const stats = statsRes.body as AdminStatsResponseDto;
      expect(stats.totalParts).toBe(2);
      expect(stats.totalQuantity).toBe(53); // 50 + 3
      expect(stats.lowStockCount).toBe(1); // Part 2 has 3
      expect(stats.outOfStockCount).toBe(0);
      expect(stats.categoriesCount).toBe(1);
      expect(stats.tagsCount).toBe(1);
      expect(stats.attributesCount).toBe(1);
      expect(stats.unitsCount).toBe(1);
      expect(stats.movementsCount).toBe(2);
      expect(stats.lowStockParts).toHaveLength(1);
      expect(stats.lowStockParts[0].sku).toBe('RES-0805-100K');
      expect(stats.lowStockParts[0].quantity).toBe(3);
      expect(stats.lowStockParts[0].categoryName).toBe('Резисторы');
      expect(stats.recentMovements).toHaveLength(2);
    });
  });

  describe('GET /api/v1/parts/summary and quantity filtering', () => {
    it('should return parts summary matching aggregate stats', async () => {
      const summaryRes = await request(serverUrl).get('/api/v1/parts/summary');
      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body).toEqual({
        totalParts: 2,
        totalQuantity: 53,
        lowStockCount: 1,
        outOfStockCount: 0,
      });
    });

    it('should filter parts by minQuantity and maxQuantity and sort by quantity', async () => {
      const filteredRes = await request(serverUrl).get(
        '/api/v1/parts?minQuantity=1&maxQuantity=5&sortBy=quantity&sortOrder=ASC',
      );
      expect(filteredRes.status).toBe(200);
      const body = filteredRes.body as PaginatedResponseDto<Part>;
      expect(body.meta.total).toBe(1);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].sku).toBe('RES-0805-100K');
      expect(body.data[0].quantity).toBe(3);
    });
  });
});
