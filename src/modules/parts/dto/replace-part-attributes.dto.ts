import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartAttributeValueInputDto } from './create-part.dto';

export class ReplacePartAttributesDto {
  @ApiProperty({
    example: 42,
    description: 'Целочисленный ID актора, выполняющего замену атрибутов',
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  actorId!: number;

  @ApiProperty({ type: [PartAttributeValueInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartAttributeValueInputDto)
  attributes!: PartAttributeValueInputDto[];
}
