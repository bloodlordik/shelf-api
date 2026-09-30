import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttributeDataType } from '../enums/attribute-data-type.enum';
import { CreateAttributeOptionDto } from './create-attribute-option.dto';

export class CreateAttributeDefinitionDto {
  @ApiProperty({
    example: 'nominal_voltage',
    description: 'Машинный уникальный ключ атрибута (snake_case латиницей)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'key must contain only lowercase latin letters, numbers, and underscores',
  })
  key!: string;

  @ApiProperty({
    example: 'Номинальное напряжение',
    description: 'Человекочитаемое название атрибута',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;

  @ApiProperty({
    enum: AttributeDataType,
    example: AttributeDataType.NUMBER,
    description: 'Тип данных динамического атрибута',
  })
  @IsEnum(AttributeDataType)
  dataType!: AttributeDataType;

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
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = false;

  @ApiPropertyOptional({
    example: false,
    description: 'Множественное значение',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isMultiple?: boolean = false;

  @ApiPropertyOptional({
    example: 0,
    description: 'Порядок сортировки',
    default: 0,
  })
  @IsInt()
  @IsOptional()
  sortOrder?: number = 0;

  @ApiPropertyOptional({
    type: [CreateAttributeOptionDto],
    description: 'Опции для enum/multi_enum типов',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttributeOptionDto)
  @IsOptional()
  options?: CreateAttributeOptionDto[];
}
