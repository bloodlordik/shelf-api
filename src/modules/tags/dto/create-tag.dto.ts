import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({
    example: 'SMD',
    description: 'Название тега/метки',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: '#3B82F6',
    description: 'Цвет метки (HEX или CSS-токен)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  color?: string;
}
