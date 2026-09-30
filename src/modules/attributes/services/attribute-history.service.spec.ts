import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AttributeHistoryService } from './attribute-history.service';
import { AttributeValueHistory } from '../entities/attribute-value-history.entity';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
import { Part } from '../../parts/entities/part.entity';
import { ActorsService } from '../../actors/services/actors.service';
import { AttributeChangeType } from '../enums/attribute-change-type.enum';

describe('AttributeHistoryService', () => {
  let service: AttributeHistoryService;
  let mockActorsService: { ensureActorExists: jest.Mock };
  let mockManager: Partial<EntityManager>;

  beforeEach(async () => {
    mockManager = {
      create: jest
        .fn()
        .mockImplementation(
          (entityClass, data: Partial<AttributeValueHistory>) => ({
            ...data,
            id: 'hist-uuid-' + Math.random(),
          }),
        ),
      save: jest
        .fn()
        .mockImplementation(
          (entityClass, entities: AttributeValueHistory[]) => {
            return Promise.resolve(entities);
          },
        ),
    };

    mockActorsService = {
      ensureActorExists: jest.fn().mockResolvedValue({ id: 5 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributeHistoryService,
        {
          provide: getRepositoryToken(AttributeValueHistory),
          useValue: {},
        },
        {
          provide: getRepositoryToken(AttributeDefinition),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Part),
          useValue: {},
        },
        {
          provide: ActorsService,
          useValue: mockActorsService,
        },
      ],
    }).compile();

    service = module.get<AttributeHistoryService>(AttributeHistoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordAttributeDiff', () => {
    it('should log CREATED when a new attribute is added', async () => {
      const result = await service.recordAttributeDiff(
        'part-1',
        [],
        [
          {
            attributeDefinitionId: 'def-voltage',
            valueNumber: 12,
          },
        ],
        5,
        mockManager as EntityManager,
      );

      expect(mockActorsService.ensureActorExists).toHaveBeenCalledWith(
        5,
        mockManager,
      );
      expect(result.length).toBe(1);
      expect(result[0].changeType).toBe(AttributeChangeType.CREATED);
      expect(result[0].newValueNumber).toBe(12);
      expect(result[0].oldValueNumber).toBeNull();
      expect(result[0].changedBy).toBe(5);
    });

    it('should log UPDATED when a scalar attribute value changes', async () => {
      const result = await service.recordAttributeDiff(
        'part-1',
        [
          {
            attributeDefinitionId: 'def-voltage',
            valueNumber: 12,
          },
        ],
        [
          {
            attributeDefinitionId: 'def-voltage',
            valueNumber: 24,
          },
        ],
        7,
        mockManager as EntityManager,
      );

      expect(result.length).toBe(1);
      expect(result[0].changeType).toBe(AttributeChangeType.UPDATED);
      expect(result[0].oldValueNumber).toBe(12);
      expect(result[0].newValueNumber).toBe(24);
      expect(result[0].changedBy).toBe(7);
    });

    it('should NOT log any history when attribute value has not changed', async () => {
      const result = await service.recordAttributeDiff(
        'part-1',
        [
          {
            attributeDefinitionId: 'def-voltage',
            valueNumber: 12,
          },
        ],
        [
          {
            attributeDefinitionId: 'def-voltage',
            valueNumber: 12,
          },
        ],
        7,
        mockManager as EntityManager,
      );

      expect(result.length).toBe(0);
    });

    it('should log DELETED when an attribute value is removed', async () => {
      const result = await service.recordAttributeDiff(
        'part-1',
        [
          {
            attributeDefinitionId: 'def-voltage',
            valueNumber: 12,
          },
        ],
        [],
        5,
        mockManager as EntityManager,
      );

      expect(result.length).toBe(1);
      expect(result[0].changeType).toBe(AttributeChangeType.DELETED);
      expect(result[0].oldValueNumber).toBe(12);
      expect(result[0].newValueNumber).toBeNull();
      expect(result[0].changedBy).toBe(5);
    });

    it('should correctly diff multiple-value attributes (CREATED and DELETED)', async () => {
      const oldVals = [
        { attributeDefinitionId: 'def-cert', valueOptionId: 'opt-iso9001' },
        { attributeDefinitionId: 'def-cert', valueOptionId: 'opt-rohs' },
      ];
      const newVals = [
        { attributeDefinitionId: 'def-cert', valueOptionId: 'opt-rohs' },
        { attributeDefinitionId: 'def-cert', valueOptionId: 'opt-aecq200' },
      ];

      const result = await service.recordAttributeDiff(
        'part-1',
        oldVals,
        newVals,
        5,
        mockManager as EntityManager,
      );

      expect(result.length).toBe(2);
      const created = result.find(
        (r) => r.changeType === AttributeChangeType.CREATED,
      );
      const deleted = result.find(
        (r) => r.changeType === AttributeChangeType.DELETED,
      );

      expect(created).toBeDefined();
      expect(created?.newValueOptionId).toBe('opt-aecq200');

      expect(deleted).toBeDefined();
      expect(deleted?.oldValueOptionId).toBe('opt-iso9001');
    });
  });
});
