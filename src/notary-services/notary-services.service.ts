import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotaryService } from './entities/notary-service.entity';
import { CreateNotaryServiceDto } from './dto/create-notary-service.dto';
import { UpdateNotaryServiceDto } from './dto/update-notary-service.dto';
import { SearchNotaryServicesDto } from './dto/search-notary-services.dto';

@Injectable()
export class NotaryServicesService {
  constructor(
    @InjectRepository(NotaryService)
    private readonly notaryServicesRepository: Repository<NotaryService>,
  ) {}

  async create(dto: CreateNotaryServiceDto): Promise<NotaryService> {
    const existing = await this.notaryServicesRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `A notary service with the name "${dto.name}" already exists`,
      );
    }
    const service = this.notaryServicesRepository.create(dto);
    return this.notaryServicesRepository.save(service);
  }

  async findAll(
    query: SearchNotaryServicesDto,
  ): Promise<{ data: NotaryService[]; total: number; page: number; limit: number }> {
    const { q, isActive, notaryId, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const qb = this.notaryServicesRepository.createQueryBuilder('service');

    if (q) {
      qb.andWhere('service.name ILIKE :q', { q: `%${q}%` });
    }

    if (isActive !== undefined) {
      qb.andWhere('service.isActive = :isActive', { isActive });
    }

    // Restrict to the services a specific notary offers (via the join table).
    if (notaryId) {
      qb.innerJoin(
        'notary_service_assignments',
        'nsa',
        'nsa."serviceId" = service.id AND nsa."userId" = :notaryId',
        { notaryId },
      );
    }

    qb.orderBy('service.createdAt', 'DESC').skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<NotaryService> {
    const service = await this.notaryServicesRepository.findOne({ where: { id } });
    if (!service) {
      throw new NotFoundException(`Notary service with id ${id} not found`);
    }
    return service;
  }

  async update(id: string, dto: UpdateNotaryServiceDto): Promise<NotaryService> {
    const service = await this.findOne(id);

    if (dto.name && dto.name !== service.name) {
      const conflict = await this.notaryServicesRepository.findOne({
        where: { name: dto.name },
      });
      if (conflict) {
        throw new ConflictException(
          `A notary service with the name "${dto.name}" already exists`,
        );
      }
    }

    Object.assign(service, dto);
    service.updatedAt = new Date();
    return this.notaryServicesRepository.save(service);
  }

  async remove(id: string): Promise<void> {
    const service = await this.findOne(id);
    await this.notaryServicesRepository.remove(service);
  }
}
