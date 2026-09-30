import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  CategoryTreeDto,
  CategoryBreadcrumbDto,
} from './dto/category-tree.dto';
import { CategoryDetailResponseDto } from './dto/category-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    if (createCategoryDto.parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID "${createCategoryDto.parentId}" not found`,
        );
      }
    }

    const category = this.categoryRepository.create({
      name: createCategoryDto.name,
      code: createCategoryDto.code || null,
      parentId: createCategoryDto.parentId || null,
    });

    return this.categoryRepository.save(category);
  }

  async findAll(
    pagination?: PaginationDto,
  ): Promise<PaginatedResponseDto<Category>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await this.categoryRepository.findAndCount({
      order: { name: 'ASC' },
      skip,
      take: limit,
    });

    return new PaginatedResponseDto(items, total, page, limit);
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }
    return category;
  }

  async getBreadcrumbs(categoryId: string): Promise<CategoryBreadcrumbDto[]> {
    const allCategories = await this.categoryRepository.find();
    const categoryMap = new Map<string, Category>();
    for (const cat of allCategories) {
      categoryMap.set(cat.id, cat);
    }

    const breadcrumbs: CategoryBreadcrumbDto[] = [];
    let currentId: string | null | undefined = categoryId;
    const visited = new Set<string>();

    while (currentId && categoryMap.has(currentId)) {
      if (visited.has(currentId)) {
        break; // Guard against unexpected cycle
      }
      visited.add(currentId);
      const cat = categoryMap.get(currentId);
      if (!cat) break;
      breadcrumbs.unshift({
        id: cat.id,
        name: cat.name,
        code: cat.code,
      });
      currentId = cat.parentId;
    }

    return breadcrumbs;
  }

  async getCategoryDetail(id: string): Promise<CategoryDetailResponseDto> {
    const category = await this.findOne(id);
    const breadcrumbs = await this.getBreadcrumbs(id);

    return {
      id: category.id,
      name: category.name,
      code: category.code,
      parentId: category.parentId,
      breadcrumbs,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async getTree(): Promise<CategoryTreeDto[]> {
    const categories = await this.categoryRepository.find({
      order: { name: 'ASC' },
    });

    const categoryMap = new Map<string, CategoryTreeDto>();
    const roots: CategoryTreeDto[] = [];

    // First pass: initialize all nodes with empty children
    for (const cat of categories) {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        code: cat.code,
        parentId: cat.parentId,
        children: [],
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      });
    }

    // Second pass: wire hierarchy
    for (const cat of categories) {
      const node = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async getAllSubcategoryIds(categoryId: string): Promise<string[]> {
    const categories = await this.categoryRepository.find();
    const childrenMap = new Map<string, string[]>();

    for (const cat of categories) {
      if (cat.parentId) {
        const list = childrenMap.get(cat.parentId) || [];
        list.push(cat.id);
        childrenMap.set(cat.parentId, list);
      }
    }

    const visited = new Set<string>([categoryId]);
    const result: string[] = [categoryId];
    const queue: string[] = [categoryId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = childrenMap.get(current) || [];
      for (const childId of children) {
        if (!visited.has(childId)) {
          visited.add(childId);
          result.push(childId);
          queue.push(childId);
        }
      }
    }
    return result;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id);

    if (updateCategoryDto.parentId !== undefined) {
      const newParentId = updateCategoryDto.parentId;

      if (newParentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }

      if (newParentId !== null) {
        const parent = await this.categoryRepository.findOne({
          where: { id: newParentId },
        });
        if (!parent) {
          throw new NotFoundException(
            `Parent category with ID "${newParentId}" not found`,
          );
        }

        // Cycle check: verify new parent is not a descendant of current category
        const descendantIds = await this.getAllSubcategoryIds(id);
        if (descendantIds.includes(newParentId)) {
          throw new BadRequestException(
            'Cannot set parent: destination category is a child/descendant of this category (cycle detected)',
          );
        }
      }

      category.parentId = newParentId;
    }

    if (updateCategoryDto.name !== undefined) {
      category.name = updateCategoryDto.name;
    }
    if (updateCategoryDto.code !== undefined) {
      category.code = updateCategoryDto.code || null;
    }

    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);

    const childCount = await this.categoryRepository.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ID "${id}" because it has ${childCount} child categories`,
      );
    }

    await this.categoryRepository.remove(category);
  }
}
