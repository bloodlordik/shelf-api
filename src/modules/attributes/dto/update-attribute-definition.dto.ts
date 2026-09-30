import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateAttributeDefinitionDto {
  @ApiPropertyOptional({
    example: 'Номинальное напряжение питания',
    description: 'Человекочитаемое название атрибута',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  label?: string;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID единицы измерения',
  })
  @IsUUID()
  @IsOptional()
  unitId?: string | null;

  @ApiPropertyOptional({
    example: false,
    description: 'Обязательность заполнения',
  })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Множественное значение',
  })
  @IsBoolean()
  @IsOptional()
  isMultiple?: boolean;

  @ApiPropertyOptional({
    example: 0,
    description: 'Порядок сортировки',
  })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
