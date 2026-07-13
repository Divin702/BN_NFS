import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dossier } from '../dossiers/entities/dossier.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';
import { ReportsFilterDto } from './dto/reports-filter.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Dossier)
    private readonly dossiersRepo: Repository<Dossier>,
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async getReport(filter: ReportsFilterDto, requestingUser: User) {
    const qb = this.dossiersRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.client', 'client')
      .leftJoinAndSelect('d.assignedNotary', 'notary')
      // Use a COUNT subquery instead of a JOIN so the clients table is
      // never joined twice (once for d.client, once for parties.client),
      // which was causing TypeORM to drop the dossier→client mapping on
      // some rows.
      .loadRelationCountAndMap('d.partiesCount', 'd.parties');

    if (requestingUser.role === Role.NOTARY_PUBLIC) {
      qb.andWhere('d.assignedNotaryId = :notaryId', {
        notaryId: requestingUser.id,
      });
    }

    if (filter.dateFrom) {
      qb.andWhere('d.createdAt >= :dateFrom', {
        dateFrom: new Date(filter.dateFrom),
      });
    }

    if (filter.dateTo) {
      const dateTo = new Date(filter.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      qb.andWhere('d.createdAt <= :dateTo', { dateTo });
    }

    if (filter.status) {
      qb.andWhere('d.status = :status', { status: filter.status });
    }

    if (filter.assignedNotaryId && requestingUser.role === Role.ADMINISTRATOR) {
      qb.andWhere('d.assignedNotaryId = :assignedNotaryId', {
        assignedNotaryId: filter.assignedNotaryId,
      });
    }

    if (filter.serviceId) {
      qb.andWhere('d.serviceId = :serviceId', { serviceId: filter.serviceId });
    }

    qb.orderBy('d.createdAt', 'DESC');
    const dossiers = await qb.getMany();

    const summary = {
      total: dossiers.length,
      open: dossiers.filter((d) => d.status === 'open').length,
      inProgress: dossiers.filter((d) => d.status === 'in_progress').length,
      completed: dossiers.filter((d) => d.status === 'completed').length,
      archived: dossiers.filter((d) => d.status === 'archived').length,
      totalOfficialFees: dossiers.reduce(
        (s, d) => s + (d.officialFee ?? 0),
        0,
      ),
      totalNotaryFees: dossiers.reduce((s, d) => s + (d.notaryFee ?? 0), 0),
      totalFees: dossiers.reduce((s, d) => s + (d.totalFee ?? 0), 0),
      uniqueClients: new Set(dossiers.map((d) => d.clientId).filter(Boolean))
        .size,
      totalDocuments: dossiers.reduce(
        (s, d) => s + (d.documents?.length ?? 0),
        0,
      ),
      totalParties: dossiers.reduce(
        (s, d) => s + ((d as unknown as { partiesCount: number }).partiesCount ?? 0),
        0,
      ),
    };

    const notaries =
      requestingUser.role === Role.ADMINISTRATOR
        ? await this.usersRepo.find({
            where: { role: Role.NOTARY_PUBLIC, isActive: true },
            select: ['id', 'firstName', 'lastName'],
          })
        : [];

    return { summary, dossiers, notaries };
  }
}
