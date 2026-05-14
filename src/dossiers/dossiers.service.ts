import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dossier, DossierStatus } from './entities/dossier.entity';
import { DossierParty } from './entities/dossier-party.entity';
import { User } from '../users/entities/user.entity';
import { NotaryService } from '../notary-services/entities/notary-service.entity';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { SearchDossiersDto } from './dto/search-dossiers.dto';

@Injectable()
export class DossiersService {
  constructor(
    @InjectRepository(Dossier)
    private readonly dossiersRepository: Repository<Dossier>,
    @InjectRepository(NotaryService)
    private readonly notaryServicesRepo: Repository<NotaryService>,
    @InjectRepository(DossierParty)
    private readonly partiesRepo: Repository<DossierParty>,
  ) {}

  generateNumber(year: number, sequence: number): string {
    return `NFS-${year}-${String(sequence).padStart(5, '0')}`;
  }

  async create(dto: CreateDossierDto, createdByUser: User): Promise<Dossier> {
    const count = await this.dossiersRepository.count();
    const year = new Date().getFullYear();
    const number = this.generateNumber(year, count + 1);

    const initialHistoryEntry = {
      status: DossierStatus.OPEN,
      changedAt: new Date().toISOString(),
      changedById: createdByUser.id,
      changedByName: `${createdByUser.firstName} ${createdByUser.lastName}`,
    };

    let serviceName: string | null = null;
    let officialFee: number | null = null;
    let totalFee: number | null = null;

    if (dto.serviceId) {
      const service = await this.notaryServicesRepo.findOne({ where: { id: dto.serviceId } });
      if (service) {
        serviceName = service.name;
        officialFee = service.officialFee;
        totalFee = officialFee + (dto.notaryFee ?? 0);
      }
    }

    const dossier = this.dossiersRepository.create({
      ...dto,
      number,
      status: DossierStatus.OPEN,
      documents: [],
      statusHistory: [initialHistoryEntry],
      serviceName,
      officialFee,
      totalFee,
    });

    const saved = await this.dossiersRepository.save(dossier);

    if (dto.parties && dto.parties.length > 0) {
      const partyEntities = dto.parties.map((p, index) =>
        this.partiesRepo.create({
          dossierId: saved.id,
          clientId: p.clientId,
          roleKey: p.roleKey,
          roleLabel: p.roleLabel,
          isPrimary: p.isPrimary ?? index === 0,
        })
      );
      await this.partiesRepo.save(partyEntities);
    }

    return saved;
  }

  async findAll(
    query: SearchDossiersDto,
  ): Promise<{ data: Dossier[]; total: number; page: number; limit: number }> {
    const { q, status, clientId, assignedNotaryId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const qb = this.dossiersRepository
      .createQueryBuilder('dossier')
      .leftJoinAndSelect('dossier.client', 'client')
      .leftJoinAndSelect('dossier.assignedNotary', 'assignedNotary')
      .leftJoinAndSelect('dossier.parties', 'parties')
      .leftJoinAndSelect('parties.client', 'partyClient');

    if (q) {
      qb.andWhere(
        '(dossier.number ILIKE :q OR client.firstName ILIKE :q OR client.lastName ILIKE :q OR client.nationalId ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    if (status) {
      qb.andWhere('dossier.status = :status', { status });
    }

    if (clientId) {
      // Match dossiers where client is primary OR a party
      qb.andWhere(
        '(dossier.clientId = :clientId OR parties.clientId = :clientId)',
        { clientId },
      );
    }

    if (assignedNotaryId) {
      qb.andWhere('dossier.assignedNotaryId = :assignedNotaryId', { assignedNotaryId });
    }

    qb.orderBy('dossier.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Dossier> {
    const dossier = await this.dossiersRepository.findOne({
      where: { id },
      relations: ['client', 'assignedNotary', 'parties', 'parties.client'],
    });
    if (!dossier) {
      throw new NotFoundException(`Dossier with id ${id} not found`);
    }
    return dossier;
  }

  async update(id: string, dto: UpdateDossierDto, updatedByUser: User): Promise<Dossier> {
    const dossier = await this.findOne(id);

    if (dto.status && dto.status !== dossier.status) {
      dossier.statusHistory = [
        ...dossier.statusHistory,
        {
          status: dto.status,
          changedAt: new Date().toISOString(),
          changedById: updatedByUser.id,
          changedByName: `${updatedByUser.firstName} ${updatedByUser.lastName}`,
        },
      ];
    }

    Object.assign(dossier, dto);
    dossier.updatedAt = new Date();

    return this.dossiersRepository.save(dossier);
  }

  async changeStatus(id: string, status: DossierStatus, changedByUser: User): Promise<Dossier> {
    const dossier = await this.findOne(id);

    if (status !== dossier.status) {
      dossier.statusHistory = [
        ...dossier.statusHistory,
        {
          status,
          changedAt: new Date().toISOString(),
          changedById: changedByUser.id,
          changedByName: `${changedByUser.firstName} ${changedByUser.lastName}`,
        },
      ];
    }

    dossier.status = status;
    dossier.updatedAt = new Date();

    return this.dossiersRepository.save(dossier);
  }

  async addDocument(id: string, dto: AddDocumentDto): Promise<Dossier> {
    const dossier = await this.findOne(id);

    dossier.documents = [
      ...dossier.documents,
      {
        name: dto.name,
        url: dto.url,
        uploadedAt: new Date().toISOString(),
      },
    ];

    dossier.updatedAt = new Date();
    return this.dossiersRepository.save(dossier);
  }

  async removeDocument(id: string, documentUrl: string): Promise<Dossier> {
    const dossier = await this.findOne(id);

    dossier.documents = dossier.documents.filter((doc) => doc.url !== documentUrl);
    dossier.updatedAt = new Date();

    return this.dossiersRepository.save(dossier);
  }

  async getStats(notaryId?: string): Promise<{
    open: number;
    inProgress: number;
    completed: number;
    archived: number;
    total: number;
  }> {
    const base = notaryId ? { assignedNotaryId: notaryId } : {};
    const [open, inProgress, completed, archived, total] = await Promise.all([
      this.dossiersRepository.count({ where: { ...base, status: DossierStatus.OPEN } }),
      this.dossiersRepository.count({ where: { ...base, status: DossierStatus.IN_PROGRESS } }),
      this.dossiersRepository.count({ where: { ...base, status: DossierStatus.COMPLETED } }),
      this.dossiersRepository.count({ where: { ...base, status: DossierStatus.ARCHIVED } }),
      this.dossiersRepository.count({ where: base }),
    ]);

    return { open, inProgress, completed, archived, total };
  }

  async updateParties(dossierId: string, parties: { clientId: string; roleKey: string; roleLabel: string; isPrimary?: boolean }[]): Promise<DossierParty[]> {
    await this.partiesRepo.delete({ dossierId });
    const entities = parties.map((p, i) => this.partiesRepo.create({
      dossierId,
      clientId: p.clientId,
      roleKey: p.roleKey,
      roleLabel: p.roleLabel,
      isPrimary: p.isPrimary ?? i === 0,
    }));
    return this.partiesRepo.save(entities);
  }

  async remove(id: string): Promise<void> {
    const dossier = await this.findOne(id);
    await this.dossiersRepository.remove(dossier);
  }
}
