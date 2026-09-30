import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttributeDataType } from '../../attributes/enums/attribute-data-type.enum';
import { UnitGroup } from '../../units/enums/unit-group.enum';
import { CategoryBreadcrumbDto } from '../../categories/dto/category-tree.dto';

export class PartCardUnitDto {
  @ApiProperty({ example: 'u1-uuid' })
  id!: string;

  @ApiProperty({ example: 'Килоом' })
  name!: string;

  @ApiProperty({ example: 'кОм' })
  symbol!: string;

  @ApiProperty({ enum: UnitGroup, example: UnitGroup.ELECTRICAL })
  group!: UnitGroup;
}

export class PartCardOptionDto {
  @ApiProperty({ example: 'opt-1-uuid' })
  id!: string;

  @ApiProperty({ example: 'smd_0805' })
  value!: string;

  @ApiProperty({ example: 'SMD 0805' })
  label!: string;
}

export class PartCardAttributeItemDto {
  @ApiProperty({ example: 'd1-uuid' })
  definitionId!: string;

  @ApiProperty({ example: 'nominal_voltage' })
  key!: string;

  @ApiProperty({ example: 'Номинальное напряжение' })
  label!: string;

  @ApiProperty({ enum: AttributeDataType, example: AttributeDataType.NUMBER })
  dataType!: AttributeDataType;

  @ApiProperty({ example: false })
  isMultiple!: boolean;

  @ApiPropertyOptional({ type: PartCardUnitDto, nullable: true })
  unit!: PartCardUnitDto | null;

  @ApiProperty({ description: 'Сырое или скалярное/массив значение' })
  value!: unknown;

  @ApiProperty({
    example: '12 В',
    description: 'Форматированное представление с единицами измерения/лейблами',
  })
  formattedValue!: string;

  @ApiPropertyOptional({ type: PartCardOptionDto, nullable: true })
  option?: PartCardOptionDto | null;

  @ApiPropertyOptional({ type: [PartCardOptionDto] })
  options?: PartCardOptionDto[];
}

export class PartCardCategoryDto {
  @ApiProperty({ example: 'c1-uuid' })
  id!: string;

  @ApiProperty({ example: 'Резисторы SMD' })
  name!: string;

  @ApiPropertyOptional({ example: 'resistors_smd' })
  code?: string | null;

  @ApiProperty({ type: [CategoryBreadcrumbDto] })
  breadcrumbs!: CategoryBreadcrumbDto[];
}

export class PartCardTagDto {
  @ApiProperty({ example: 't1-uuid' })
  id!: string;

  @ApiProperty({ example: 'SMD' })
  name!: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  color?: string | null;
}

export class PartCardStockSummaryDto {
  @ApiPropertyOptional({ example: '2026-09-24T10:00:00.000Z', nullable: true })
  lastMovementAt!: Date | null;

  @ApiProperty({ example: 5 })
  totalMovementsCount!: number;
}

export class PartCardResponseDto {
  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  id!: string;

  @ApiProperty({ example: 'Резистор SMD 10 кОм 0.125Вт 1% 0805' })
  name!: string;

  @ApiProperty({ example: 'RES-0805-10K-F' })
  sku!: string;

  @ApiPropertyOptional({ example: 'Тонкопленочный SMD резистор' })
  description?: string | null;

  @ApiProperty({
    example: 120,
    description: 'Текущее количество детали на складе (кэш журнала движений)',
  })
  quantity!: number;

  @ApiPropertyOptional({ type: PartCardStockSummaryDto })
  stockSummary?: PartCardStockSummaryDto;

  @ApiPropertyOptional({ type: PartCardCategoryDto, nullable: true })
  category!: PartCardCategoryDto | null;

  @ApiProperty({ type: [PartCardTagDto] })
  tags!: PartCardTagDto[];

  @ApiProperty({ type: [PartCardAttributeItemDto] })
  attributes!: PartCardAttributeItemDto[];

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  updatedAt!: Date;
}
