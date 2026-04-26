import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

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

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  save(user: User) {
    return this.repo.save(user);
  }

  create(data: Partial<User>) {
    return this.repo.create(data);
  }
}
