import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Резисторы SMD',
    description: 'Название категории',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    example: 'resistors_smd',
    description: 'Уникальный код категории',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID родительской категории',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string | null;
}
