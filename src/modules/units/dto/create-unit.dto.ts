import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UnitGroup } from '../enums/unit-group.enum';

export class CreateUnitDto {
  @ApiProperty({
    example: 'Миллиметр',
    description: 'Полное название единицы измерения',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'мм',
    description: 'Обозначение единицы измерения',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  symbol!: string;

  @ApiPropertyOptional({
    enum: UnitGroup,
    example: UnitGroup.LENGTH,
    description: 'Группа единиц измерения',
    default: UnitGroup.OTHER,
  })
  @IsEnum(UnitGroup)
  @IsOptional()
  group?: UnitGroup = UnitGroup.OTHER;
}
