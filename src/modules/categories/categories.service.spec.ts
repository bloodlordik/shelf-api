import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { BadRequestException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const mockCategories: Category[] = [
    {
      id: 'root-1',
      name: 'Пассивные компоненты',
      code: 'passives',
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'sub-1',
      name: 'Резисторы',
      code: 'resistors',
      parentId: 'root-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'sub-2',
      name: 'Резисторы SMD',
      code: 'resistors_smd',
      parentId: 'sub-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'root-2',
      name: 'Активные компоненты',
      code: 'actives',
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  let repoMock: {
    find: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    repoMock = {
      find: jest.fn().mockResolvedValue(mockCategories),
      findOne: jest.fn().mockImplementation(({ where: { id } }) => {
        const found = mockCategories.find((c) => c.id === id);
        return Promise.resolve(found || null);
      }),
      count: jest.fn().mockImplementation(({ where: { parentId } }) => {
        const count = mockCategories.filter(
          (c) => c.parentId === parentId,
        ).length;
        return Promise.resolve(count);
      }),
      create: jest
        .fn()
        .mockImplementation((dto: Partial<Category>) => dto as Category),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      remove: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: repoMock,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should build hierarchical tree from flat categories list', async () => {
    const tree = await service.getTree();

    expect(tree).toHaveLength(2); // root-1 and root-2

    const passives = tree.find((t) => t.id === 'root-1');
    expect(passives).toBeDefined();
    expect(passives?.children).toHaveLength(1); // 'sub-1' (Резисторы)

    const resistors = passives?.children[0];
    expect(resistors?.id).toBe('sub-1');
    expect(resistors?.children).toHaveLength(1); // 'sub-2' (Резисторы SMD)
    expect(resistors?.children[0].id).toBe('sub-2');
  });

  it('should return correct breadcrumbs from root to leaf', async () => {
    const breadcrumbs = await service.getBreadcrumbs('sub-2');

    expect(breadcrumbs).toHaveLength(3);
    expect(breadcrumbs[0].id).toBe('root-1');
    expect(breadcrumbs[0].name).toBe('Пассивные компоненты');
    expect(breadcrumbs[1].id).toBe('sub-1');
    expect(breadcrumbs[1].name).toBe('Резисторы');
    expect(breadcrumbs[2].id).toBe('sub-2');
    expect(breadcrumbs[2].name).toBe('Резисторы SMD');
  });

  it('should return all descendant IDs for a category', async () => {
    const subIds = await service.getAllSubcategoryIds('root-1');
    expect(subIds).toContain('root-1');
    expect(subIds).toContain('sub-1');
    expect(subIds).toContain('sub-2');
    expect(subIds).not.toContain('root-2');
  });

  it('should reject setting category as its own parent', async () => {
    await expect(
      service.update('root-1', { parentId: 'root-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject setting descendant category as parent (cycle prevention)', async () => {
    await expect(
      service.update('root-1', { parentId: 'sub-2' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject deletion when category has children', async () => {
    await expect(service.remove('root-1')).rejects.toThrow(BadRequestException);
  });
});
