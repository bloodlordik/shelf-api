import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
  ) {}

  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const trimmedName = createTagDto.name.trim();

    const existing = await this.tagsRepository.findOne({
      where: { name: ILike(trimmedName) },
    });
    if (existing) {
      throw new ConflictException(
        `Tag with name "${trimmedName}" already exists`,
      );
    }

    const tag = this.tagsRepository.create({
      name: trimmedName,
      color: createTagDto.color || null,
    });
    return this.tagsRepository.save(tag);
  }

  async findAll(search?: string): Promise<Tag[]> {
    if (search && search.trim()) {
      return this.tagsRepository.find({
        where: { name: ILike(`%${search.trim()}%`) },
        order: { name: 'ASC' },
      });
    }
    return this.tagsRepository.find({
      order: { name: 'ASC' },
    });
  }

  async count(): Promise<number> {
    return this.tagsRepository.count();
  }

  async findOne(id: string): Promise<Tag> {
    const tag = await this.tagsRepository.findOne({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found`);
    }
    return tag;
  }

  async findByIds(ids: string[]): Promise<Tag[]> {
    if (!ids || ids.length === 0) return [];
    return this.tagsRepository.find({
      where: { id: In(ids) },
    });
  }

  async update(id: string, updateTagDto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findOne(id);

    if (updateTagDto.name !== undefined) {
      const trimmedName = updateTagDto.name.trim();
      const existing = await this.tagsRepository.findOne({
        where: { name: ILike(trimmedName) },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Tag with name "${trimmedName}" already exists`,
        );
      }
      tag.name = trimmedName;
    }

    if (updateTagDto.color !== undefined) {
      tag.color = updateTagDto.color || null;
    }

    return this.tagsRepository.save(tag);
  }

  async remove(id: string): Promise<void> {
    const tag = await this.findOne(id);
    await this.tagsRepository.remove(tag);
  }
}
