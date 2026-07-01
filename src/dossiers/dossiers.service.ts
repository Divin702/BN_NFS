import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dossier, DossierStatus } from './entities/dossier.entity';
import { DossierParty } from './entities/dossier-party.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';
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
      const service = await this.notaryServicesRepo.findOne({
        where: { id: dto.serviceId },
      });
      if (service) {
        serviceName = service.name;
        officialFee = service.officialFee;
        totalFee = officialFee + (dto.notaryFee ?? 0);
      }
    }

    // When a notary creates the dossier and no notary was explicitly assigned,
    // assign the creating notary so the dossier always records its officer.
    const assignedNotaryId =
      dto.assignedNotaryId ??
      (createdByUser.role === Role.NOTARY_PUBLIC ? createdByUser.id : null);

    const dossier = this.dossiersRepository.create({
      ...dto,
      assignedNotaryId,
      number,
      status: DossierStatus.OPEN,
      documents: [],
      statusHistory: [initialHistoryEntry],
      serviceName,
      officialFee,
      totalFee,
      // Stamp the notary's signature on the dossier; fall back to the creator's.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      notarySignatureUrl:
        dto.notarySignatureUrl ?? createdByUser.signature ?? null,
    });

    const saved = await this.dossiersRepository.save(dossier);

    const filledParties = (dto.parties ?? []).filter((p) => p.clientId);
    if (filledParties.length > 0) {
      const partyEntities = filledParties.map((p, index) =>
        this.partiesRepo.create({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          dossierId: saved.id,
          clientId: p.clientId ?? null,
          roleKey: p.roleKey,
          roleLabel: p.roleLabel,
          isPrimary: p.isPrimary ?? index === 0,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          signatureUrl: p.signatureUrl ?? null,
        }),
      );
      await this.partiesRepo.save(partyEntities);
    }

    return saved;
  }

  async findAll(
    query: SearchDossiersDto,
  ): Promise<{ data: Dossier[]; total: number; page: number; limit: number }> {
    const {
      q,
      status,
      clientId,
      assignedNotaryId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = query;
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
      qb.andWhere(
        '(dossier.clientId = :clientId OR parties.clientId = :clientId)',
        { clientId },
      );
    }

    if (assignedNotaryId) {
      qb.andWhere('dossier.assignedNotaryId = :assignedNotaryId', {
        assignedNotaryId,
      });
    }

    if (dateFrom) {
      qb.andWhere('dossier.createdAt >= :dateFrom', {
        dateFrom: new Date(dateFrom),
      });
    }

    if (dateTo) {
      qb.andWhere('dossier.createdAt <= :dateTo', { dateTo: new Date(dateTo) });
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

  async update(
    id: string,
    dto: UpdateDossierDto,
    updatedByUser: User,
  ): Promise<Dossier> {
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

  async changeStatus(
    id: string,
    status: DossierStatus,
    changedByUser: User,
  ): Promise<Dossier> {
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

    dossier.documents = dossier.documents.filter(
      (doc) => doc.url !== documentUrl,
    );
    dossier.updatedAt = new Date();

    return this.dossiersRepository.save(dossier);
  }

  async getStats(
    notaryId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    open: number;
    inProgress: number;
    completed: number;
    archived: number;
    total: number;
  }> {
    const buildQb = (status?: DossierStatus) => {
      const qb = this.dossiersRepository.createQueryBuilder('d');
      if (notaryId) qb.andWhere('d.assignedNotaryId = :notaryId', { notaryId });
      if (status) qb.andWhere('d.status = :status', { status });
      if (dateFrom)
        qb.andWhere('d.createdAt >= :dateFrom', {
          dateFrom: new Date(dateFrom),
        });
      if (dateTo)
        qb.andWhere('d.createdAt <= :dateTo', { dateTo: new Date(dateTo) });
      return qb.getCount();
    };

    const [open, inProgress, completed, archived, total] = await Promise.all([
      buildQb(DossierStatus.OPEN),
      buildQb(DossierStatus.IN_PROGRESS),
      buildQb(DossierStatus.COMPLETED),
      buildQb(DossierStatus.ARCHIVED),
      buildQb(),
    ]);

    return { open, inProgress, completed, archived, total };
  }

  async updateParties(
    dossierId: string,
    parties: {
      clientId: string;
      roleKey: string;
      roleLabel: string;
      isPrimary?: boolean;
    }[],
  ): Promise<DossierParty[]> {
    await this.partiesRepo.delete({ dossierId });
    const entities = parties.map((p, i) =>
      this.partiesRepo.create({
        dossierId,
        clientId: p.clientId,
        roleKey: p.roleKey,
        roleLabel: p.roleLabel,
        isPrimary: p.isPrimary ?? i === 0,
      }),
    );
    return this.partiesRepo.save(entities);
  }

  async remove(id: string): Promise<void> {
    const dossier = await this.findOne(id);
    await this.dossiersRepository.remove(dossier);
  }
}
