import {
  ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentTemplate } from './entities/document-template.entity';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';
import { QueryDocumentTemplateDto } from './dto/query-document-template.dto';

function bumpPatchVersion(version: string): string {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return version;
  parts[2] += 1;
  return parts.join('.');
}

@Injectable()
export class DocumentTemplatesService {
  constructor(
    @InjectRepository(DocumentTemplate)
    private readonly repo: Repository<DocumentTemplate>,
  ) {}

  async findAll(query: QueryDocumentTemplateDto) {
    const { search, categoryId, status, page = 1, limit = 20 } = query;
    const qb = this.repo.createQueryBuilder('t')
      .leftJoinAndSelect('t.category', 'category')
      .orderBy('t.createdAt', 'DESC');

    if (search) {
      qb.andWhere('(t.name ILIKE :s OR t.templateCode ILIKE :s)', { s: `%${search}%` });
    }
    if (categoryId) {
      qb.andWhere('t.categoryId = :categoryId', { categoryId });
    }
    if (status) {
      qb.andWhere('t.status = :status', { status });
    }

    const total = await qb.getCount();
    const data = await qb.skip((page - 1) * limit).take(limit).getMany();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const tpl = await this.repo.findOne({ where: { id }, relations: ['category', 'createdBy'] });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  async create(dto: CreateDocumentTemplateDto, userId: string) {
    const exists = await this.repo.findOne({ where: { templateCode: dto.templateCode } });
    if (exists) throw new ConflictException('Template code already exists');
    const tpl = this.repo.create({ ...dto, createdById: userId });
    return this.repo.save(tpl);
  }

  async update(id: string, dto: UpdateDocumentTemplateDto) {
    const tpl = await this.findOne(id);
    tpl.version = bumpPatchVersion(tpl.version);

    if (dto.templateCode && dto.templateCode !== tpl.templateCode) {
      const conflict = await this.repo.findOne({ where: { templateCode: dto.templateCode } });
      if (conflict) throw new ConflictException('Template code already exists');
    }

    Object.assign(tpl, dto);
    return this.repo.save(tpl);
  }

  async remove(id: string) {
    const tpl = await this.findOne(id);
    await this.repo.remove(tpl);
    return { message: 'Template deleted' };
  }
}
