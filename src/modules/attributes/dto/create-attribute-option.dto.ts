import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAttributeOptionDto {
  @ApiProperty({
    example: 'smd_0805',
    description: 'Техническое значение опции',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  value!: string;

  @ApiProperty({
    example: 'SMD 0805',
    description: 'Отображаемое название опции',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Порядок сортировки',
    default: 0,
  })
  @IsInt()
  @IsOptional()
  sortOrder?: number = 0;
}
