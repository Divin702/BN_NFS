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

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(Dossier)
    private readonly dossiersRepository: Repository<Dossier>,
    @InjectRepository(DossierParty)
    private readonly partiesRepository: Repository<DossierParty>,
  ) {}

  async create(dto: CreateClientDto): Promise<Client> {
    const existing = await this.clientsRepository.findOne({
      where: { nationalId: dto.nationalId },
    });
    if (existing) {
      throw new ConflictException(
        `A client with national ID ${dto.nationalId} already exists`,
      );
    }
    const client = this.clientsRepository.create(dto);
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
      // Collect clients from this notary's dossiers — both primary client and party clients
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
      const clientIds = [
        ...new Set([
          ...dossiers.map((d) => d.clientId).filter(Boolean),
          ...parties.map((p) => p.clientId).filter(Boolean),
        ]),
      ] as string[];
      if (clientIds.length === 0) return { data: [], total: 0, page, limit };
      qb.andWhere('client.id IN (:...clientIds)', { clientIds });
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
