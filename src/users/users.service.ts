import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './enums/role.enum';

export interface UsersQuery {
  search?: string;
  role?: Role;
  status?: 'active' | 'inactive' | 'disabled' | 'pending';
  page?: number;
  limit?: number;
}

export type SafeUser = Omit<User, 'password' | 'invitationToken' | 'hashPassword' | 'validatePassword'>;

export interface PaginatedUsers {
  data: SafeUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findByNationalId(nationalId: string) {
    return this.repo.findOne({ where: { nationalId } });
  }

  findByPhoneNumber(phoneNumber: string) {
    return this.repo.findOne({ where: { phoneNumber } });
  }

  findByInvitationToken(token: string) {
    return this.repo.findOne({ where: { invitationToken: token } });
  }

  findByPasswordResetToken(token: string) {
    return this.repo.findOne({ where: { passwordResetToken: token } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async findAll(query: UsersQuery): Promise<PaginatedUsers> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('u');

    if (query.search) {
      const term = `%${query.search}%`;
      qb.andWhere(
        '(u.firstName ILIKE :t OR u.lastName ILIKE :t OR u.email ILIKE :t OR u.nationalId ILIKE :t OR CONCAT(u.firstName, \' \', u.lastName) ILIKE :t)',
        { t: term },
      );
    }

    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }

    if (query.status === 'active') {
      qb.andWhere('u.isActive = true AND u.isDisabled = false');
    } else if (query.status === 'inactive') {
      qb.andWhere('u.isActive = false AND u.invitationAccepted = true');
    } else if (query.status === 'disabled') {
      qb.andWhere('u.isDisabled = true');
    } else if (query.status === 'pending') {
      qb.andWhere('u.isActive = false AND u.invitationAccepted = false AND u.invitationToken IS NOT NULL');
    }

    qb.orderBy('u.createdAt', 'DESC');
    qb.skip(skip).take(limit);

    const [users, total] = await qb.getManyAndCount();

    const data = users.map(({ password, invitationToken, ...safe }) => safe);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findMyClients(notaryId: string, query: UsersQuery): Promise<PaginatedUsers> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('u')
      .andWhere('u.createdById = :notaryId', { notaryId });

    if (query.search) {
      const term = `%${query.search}%`;
      qb.andWhere(
        '(u.firstName ILIKE :t OR u.lastName ILIKE :t OR u.email ILIKE :t OR u.nationalId ILIKE :t OR CONCAT(u.firstName, \' \', u.lastName) ILIKE :t)',
        { t: term },
      );
    }

    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }

    if (query.status === 'active') {
      qb.andWhere('u.isActive = true AND u.isDisabled = false');
    } else if (query.status === 'disabled') {
      qb.andWhere('u.isDisabled = true');
    } else if (query.status === 'pending') {
      qb.andWhere('u.isActive = false AND u.invitationToken IS NOT NULL');
    }

    qb.orderBy('u.createdAt', 'DESC').skip(skip).take(limit);

    const [users, total] = await qb.getManyAndCount();
    const data = users.map(({ password, invitationToken, ...safe }) => safe);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  save(user: User) {
    return this.repo.save(user);
  }

  create(data: Partial<User>) {
    return this.repo.create(data);
  }

  remove(id: string) {
    return this.repo.delete(id);
  }
}
