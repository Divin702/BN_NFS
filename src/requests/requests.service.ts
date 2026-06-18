import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotarizationRequest, RequestStatus } from './entities/notarization-request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { Role } from '../users/enums/role.enum';
import { User } from '../users/entities/user.entity';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(NotarizationRequest)
    private readonly repo: Repository<NotarizationRequest>,
  ) {}

  async create(dto: CreateRequestDto, client: User) {
    const req = this.repo.create({
      ...dto,
      clientId: client.id,
    });
    return this.repo.save(req);
  }

  async findForUser(user: User) {
    if (user.role === Role.CLIENT) {
      return this.repo.find({
        where: { clientId: user.id },
        order: { createdAt: 'DESC' },
      });
    }
    if (user.role === Role.NOTARY_PUBLIC) {
      return this.repo.find({
        where: { notaryId: user.id },
        order: { createdAt: 'DESC' },
      });
    }
    // Administrator sees all
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    return req;
  }

  async update(id: string, dto: UpdateRequestDto, user: User) {
    const req = await this.findOne(id);

    if (user.role === Role.NOTARY_PUBLIC && req.notaryId !== user.id) {
      throw new ForbiddenException('You can only update requests assigned to you');
    }
    if (user.role === Role.CLIENT && req.clientId !== user.id) {
      throw new ForbiddenException('You can only update your own requests');
    }

    Object.assign(req, dto);
    return this.repo.save(req);
  }

  async remove(id: string, user: User) {
    const req = await this.findOne(id);
    if (user.role === Role.CLIENT && req.clientId !== user.id) {
      throw new ForbiddenException('You can only delete your own requests');
    }
    if (req.status !== RequestStatus.PENDING) {
      throw new ForbiddenException('Only pending requests can be deleted');
    }
    await this.repo.remove(req);
    return { message: 'Request deleted' };
  }
}
