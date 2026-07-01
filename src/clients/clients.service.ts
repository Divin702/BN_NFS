import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { SearchClientsDto } from './dto/search-clients.dto';
import { Dossier } from '../dossiers/entities/dossier.entity';
import { DossierParty } from '../dossiers/entities/dossier-party.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(Dossier)
    private readonly dossiersRepository: Repository<Dossier>,
    @InjectRepository(DossierParty)
    private readonly partiesRepository: Repository<DossierParty>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateClientDto, createdByNotaryId?: string): Promise<Client> {
    const existing = await this.clientsRepository.findOne({
      where: { nationalId: dto.nationalId },
    });
    if (existing) {
      throw new ConflictException(
        `A client with national ID ${dto.nationalId} already exists`,
      );
    }
    const client = this.clientsRepository.create({
      ...dto,
      createdByNotaryId: createdByNotaryId ?? null,
    });
    return this.clientsRepository.save(client);
  }

  async findAll(
    query: SearchClientsDto,
    notaryId?: string,
  ): Promise<{ data: Client[]; total: number; page: number; limit: number }> {
    const { q, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const qb = this.clientsRepository.createQueryBuilder('client');

    if (notaryId) {
      // Show clients this notary created, plus clients in their dossiers (primary + party slots)
      const [dossiers, parties] = await Promise.all([
        this.dossiersRepository.find({
          where: { assignedNotaryId: notaryId },
          select: ['clientId'],
        }),
        this.partiesRepository
          .createQueryBuilder('p')
          .innerJoin('p.dossier', 'd', 'd.assignedNotaryId = :notaryId', { notaryId })
          .select('p.clientId')
          .getMany(),
      ]);
      const dossierClientIds = [
        ...new Set([
          ...dossiers.map((d) => d.clientId).filter(Boolean),
          ...parties.map((p) => p.clientId).filter(Boolean),
        ]),
      ] as string[];

      if (dossierClientIds.length > 0) {
        qb.andWhere(
          '(client.createdByNotaryId = :notaryId OR client.id IN (:...dossierClientIds))',
          { notaryId, dossierClientIds },
        );
      } else {
        qb.andWhere('client.createdByNotaryId = :notaryId', { notaryId });
      }
    }

    if (q) {
      qb.andWhere(
        '(client.firstName ILIKE :q OR client.lastName ILIKE :q OR client.nationalId ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    qb.orderBy('client.createdAt', 'DESC').skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.clientsRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client with id ${id} not found`);
    }
    return client;
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);

    if (dto.nationalId && dto.nationalId !== client.nationalId) {
      const conflict = await this.clientsRepository.findOne({
        where: { nationalId: dto.nationalId },
      });
      if (conflict) {
        throw new ConflictException(
          `A client with national ID ${dto.nationalId} already exists`,
        );
      }
    }

    Object.assign(client, dto);
    client.updatedAt = new Date();
    return this.clientsRepository.save(client);
  }

  async remove(id: string): Promise<void> {
    const client = await this.findOne(id);

    // Detach this client from any dossiers where they are the primary client.
    // The Dossier FK has no onDelete rule, so PostgreSQL would reject the delete without this.
    await this.dossiersRepository
      .createQueryBuilder()
      .update()
      .set({ clientId: null })
      .where('"clientId" = :id', { id })
      .execute();

    // Also remove the login account so the client can no longer sign in
    const userAccount = await this.usersRepository.findOne({
      where: { nationalId: client.nationalId, role: Role.CLIENT },
    });
    if (userAccount) {
      await this.usersRepository.remove(userAccount);
    }

    await this.clientsRepository.remove(client);
  }

  async saveFingerprint(id: string, template: string): Promise<Client> {
    const client = await this.findOne(id);
    client.fingerprintTemplate = template;
    client.updatedAt = new Date();
    return this.clientsRepository.save(client);
  }

  async removeFingerprint(id: string): Promise<Client> {
    const client = await this.findOne(id);
    client.fingerprintTemplate = null;
    client.updatedAt = new Date();
    return this.clientsRepository.save(client);
  }

  async getAllFingerprintTemplates(): Promise<{ clientId: string; template: string }[]> {
    const clients = await this.clientsRepository.find({
      where: { fingerprintTemplate: Not(IsNull()) },
      select: ['id', 'fingerprintTemplate'],
    });
    return clients.map((c) => ({ clientId: c.id, template: c.fingerprintTemplate! }));
  }
}
