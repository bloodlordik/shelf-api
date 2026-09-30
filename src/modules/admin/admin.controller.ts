import { Controller, Get, HttpStatus, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminStatsResponseDto } from './dto/admin-stats.dto';

@ApiTags('admin')
@Controller({ path: 'admin', version: VERSION_NEUTRAL })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Получить агрегированную статистику дашборда склада',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика склада',
    type: AdminStatsResponseDto,
  })
  async getStats(): Promise<AdminStatsResponseDto> {
    return this.adminService.getStats();
  }
}
