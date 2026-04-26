import {
  ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateCategory } from './entities/template-category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

@Injectable()
export class TemplateCategoriesService {
  constructor(
    @InjectRepository(TemplateCategory)
    private readonly repo: Repository<TemplateCategory>,
  ) {}

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(dto: CreateCategoryDto) {
    const slug = toSlug(dto.name);
    const exists = await this.repo.findOne({ where: [{ name: dto.name }, { slug }] });
    if (exists) throw new ConflictException('Category name already exists');
    const cat = this.repo.create({ ...dto, slug });
    return this.repo.save(cat);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const cat = await this.findOne(id);
    if (dto.name) {
      const slug = toSlug(dto.name);
      const conflict = await this.repo.findOne({ where: [{ name: dto.name }, { slug }] });
      if (conflict && conflict.id !== id) throw new ConflictException('Category name already exists');
      cat.slug = slug;
    }
    Object.assign(cat, dto);
    return this.repo.save(cat);
  }

  async remove(id: string) {
    const cat = await this.findOne(id);
    await this.repo.remove(cat);
    return { message: 'Category deleted' };
  }
}
