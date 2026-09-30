import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PartAttributeValueInputDto {
  @ApiPropertyOptional({
    example: 'nominal_voltage',
    description: 'Машинный ключ определения атрибута',
  })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'UUID определения атрибута',
  })
  @IsOptional()
  @IsUUID()
  attributeDefinitionId?: string;

  @ApiProperty({
    example: 12.0,
    description: 'Значение атрибута (скаляр, ID опции или массив)',
  })
  @IsNotEmpty()
  value!: unknown;
}

export class CreatePartDto {
  @ApiProperty({
    example: 'Резистор SMD 10 кОм 0805 1%',
    description: 'Наименование детали',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    example: 'RES-0805-10K-1%',
    description: 'Уникальный артикул / парт-номер (SKU)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku!: string;

  @ApiPropertyOptional({
    example: 'Тонкопленочный чип-резистор',
    description: 'Описание детали',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID категории',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['7b8f9e10-1234-4567-89ab-cdef01234567'],
    description: 'Список UUID тегов детали',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({
    type: [PartAttributeValueInputDto],
    description: 'Динамические атрибуты детали',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartAttributeValueInputDto)
  attributes?: PartAttributeValueInputDto[];

  @ApiPropertyOptional({
    example: 42,
    description: 'Целочисленный ID актора (пользователя), создающего деталь',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  actorId?: number;
}
