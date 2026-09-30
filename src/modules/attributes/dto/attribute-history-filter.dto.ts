import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AttributeChangeType } from '../enums/attribute-change-type.enum';

export class AttributeHistoryFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'UUID определения атрибута',
  })
  @IsOptional()
  @IsUUID()
  attributeDefinitionId?: string;

  @ApiPropertyOptional({ enum: AttributeChangeType })
  @IsOptional()
  @IsEnum(AttributeChangeType)
  changeType?: AttributeChangeType;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-09-24T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    example: 42,
    description: 'Фильтр по целочисленному ID актора',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  changedBy?: number;
}
