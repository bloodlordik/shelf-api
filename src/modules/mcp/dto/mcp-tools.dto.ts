import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsObject,
  IsIn,
  IsNotEmpty,
} from 'class-validator';

export class HelpToolDto {
  @ApiPropertyOptional({
    description:
      'Тема справки (например: pagination, actors, attributes, stock, overview)',
    example: 'stock',
  })
  @IsOptional()
  @IsString()
  topic?: string;
}

export class IndexToolDto {
  @ApiPropertyOptional({
    description:
      'Фильтр по Swagger-тегу (например: parts, stock, attributes, categories, units, tags, health)',
    example: 'parts',
  })
  @IsOptional()
  @IsString()
  tag?: string;
}

export class DescribeToolDto {
  @ApiPropertyOptional({
    description:
      'Путь к эндпоинту (например: /parts, /api/v1/parts, /categories/:id/tree)',
    example: '/parts',
  })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({
    description: 'HTTP метод (GET, POST, PUT, PATCH, DELETE)',
    example: 'POST',
    enum: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'get',
      'post',
      'put',
      'patch',
      'delete',
    ],
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: 'Operation ID метода из OpenAPI спецификации',
    example: 'PartsController_create',
  })
  @IsOptional()
  @IsString()
  operationId?: string;
}

export class SearchToolDto {
  @ApiProperty({
    description:
      'Поисковый запрос (поиск по URL, summary, description, полям DTO и параметрам)',
    example: 'movement',
  })
  @IsString()
  @IsNotEmpty()
  query!: string;

  @ApiPropertyOptional({
    description: 'Фильтр по Swagger-тегу',
    example: 'stock',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по HTTP методу (GET, POST, PUT, PATCH, DELETE)',
    example: 'POST',
  })
  @IsOptional()
  @IsString()
  method?: string;
}

export class ExecuteToolBodyDto {
  @ApiPropertyOptional({
    description:
      'Имя инструмента (если используется эндпоинт POST /tools/execute)',
    example: 'describe',
  })
  @IsOptional()
  @IsString()
  tool?: string;

  @ApiPropertyOptional({
    description: 'Аргументы для вызова инструмента MCP',
    example: { query: 'parts' },
  })
  @IsOptional()
  @IsObject()
  arguments?: Record<string, unknown>;
}

export class McpJsonRpcBodyDto {
  @ApiProperty({ example: '2.0', description: 'Версия JSON-RPC протокола' })
  @IsString()
  @IsIn(['2.0'])
  jsonrpc!: '2.0';

  @ApiPropertyOptional({ example: 1, description: 'Идентификатор запроса' })
  @IsOptional()
  id?: string | number | null;

  @ApiProperty({ example: 'tools/call', description: 'Метод протокола MCP' })
  @IsString()
  @IsNotEmpty()
  method!: string;

  @ApiPropertyOptional({
    description: 'Параметры метода JSON-RPC',
    example: { name: 'help', arguments: {} },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
