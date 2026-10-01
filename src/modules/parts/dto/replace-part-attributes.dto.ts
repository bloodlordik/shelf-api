import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartAttributeValueInputDto } from './create-part.dto';

export class ReplacePartAttributesDto {
  @ApiPropertyOptional({
    example: 42,
    description: 'Целочисленный ID актора, выполняющего замену атрибутов',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  actorId?: number;

  @ApiProperty({ type: [PartAttributeValueInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartAttributeValueInputDto)
  attributes!: PartAttributeValueInputDto[];
}
