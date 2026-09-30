import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminStatsResponseDto } from './dto/admin-stats.dto';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: {
    getStats: jest.Mock<Promise<AdminStatsResponseDto>, []>;
  };

  const mockStats: AdminStatsResponseDto = {
    totalParts: 20,
    totalQuantity: 500,
    lowStockCount: 2,
    outOfStockCount: 1,
    categoriesCount: 5,
    tagsCount: 7,
    attributesCount: 10,
    unitsCount: 6,
    movementsCount: 30,
    recentMovements: [],
    lowStockParts: [],
  };

  beforeEach(async () => {
    adminService = {
      getStats: jest
        .fn<Promise<AdminStatsResponseDto>, []>()
        .mockResolvedValue(mockStats),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: adminService }],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return aggregated stats', async () => {
    const result = await controller.getStats();
    expect(result).toEqual(mockStats);
    expect(adminService.getStats).toHaveBeenCalledTimes(1);
  });
});
