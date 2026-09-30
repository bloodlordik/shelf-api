import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from './entities/unit.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitGroup } from './enums/unit-group.enum';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
  ) {}

  async create(createUnitDto: CreateUnitDto): Promise<Unit> {
    const unit = this.unitsRepository.create(createUnitDto);
    return this.unitsRepository.save(unit);
  }

  async findAll(group?: UnitGroup): Promise<Unit[]> {
    if (group) {
      return this.unitsRepository.find({
        where: { group },
        order: { name: 'ASC' },
      });
    }
    return this.unitsRepository.find({
      order: { group: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Unit> {
    const unit = await this.unitsRepository.findOne({ where: { id } });
    if (!unit) {
      throw new NotFoundException(`Unit with ID "${id}" not found`);
    }
    return unit;
  }

  async update(id: string, updateUnitDto: UpdateUnitDto): Promise<Unit> {
    const unit = await this.findOne(id);
    Object.assign(unit, updateUnitDto);
    return this.unitsRepository.save(unit);
  }

  async remove(id: string): Promise<void> {
    const unit = await this.findOne(id);
    await this.unitsRepository.remove(unit);
  }
}
