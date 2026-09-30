import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActorsService } from './actors.service';
import { Actor } from '../entities/actor.entity';

describe('ActorsService', () => {
  let service: ActorsService;
  let mockManager: { query: jest.Mock };
  let mockRepo: {
    manager: { query: jest.Mock };
    findOneByOrFail: jest.Mock;
    findOneBy: jest.Mock;
  };

  beforeEach(async () => {
    mockManager = {
      query: jest.fn().mockResolvedValue([]),
    };

    mockRepo = {
      manager: mockManager,
      findOneByOrFail: jest.fn().mockResolvedValue({
        id: 42,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      }),
      findOneBy: jest.fn().mockResolvedValue({
        id: 42,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActorsService,
        {
          provide: getRepositoryToken(Actor),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ActorsService>(ActorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('ensureActorExists should execute upsert query and return actor', async () => {
    const actor = await service.ensureActorExists(42);
    expect(actor).toBeDefined();
    expect(actor.id).toBe(42);
    expect(mockManager.query).toHaveBeenCalled();
    expect(mockRepo.findOneByOrFail).toHaveBeenCalledWith({ id: 42 });
  });

  it('findOne should return actor by id', async () => {
    const actor = await service.findOne(42);
    expect(actor).toBeDefined();
    expect(actor?.id).toBe(42);
    expect(mockRepo.findOneBy).toHaveBeenCalledWith({ id: 42 });
  });
});
