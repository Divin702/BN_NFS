import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
  ) {}

  create(dto: CreateAppointmentDto, client: User) {
    const appt = this.repo.create({
      ...dto,
      clientId: client.id,
    });
    return this.repo.save(appt);
  }

  findAll(user: User) {
    if (user.role === Role.CLIENT) {
      return this.repo.find({
        where: { clientId: user.id },
        order: { requestedDate: 'DESC' },
      });
    }
    if (user.role === Role.NOTARY_PUBLIC) {
      return this.repo.find({
        where: { notaryId: user.id },
        order: { requestedDate: 'ASC' },
      });
    }
    return this.repo.find({ order: { requestedDate: 'DESC' } });
  }

  async update(id: string, dto: UpdateAppointmentDto, user: User) {
    const appt = await this.repo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');

    if (user.role === Role.CLIENT) {
      if (appt.clientId !== user.id) throw new ForbiddenException();
      if (dto.status && dto.status !== AppointmentStatus.CANCELLED)
        throw new ForbiddenException('Client can only cancel appointments');
    }

    if (user.role === Role.NOTARY_PUBLIC && appt.notaryId !== user.id)
      throw new ForbiddenException();

    Object.assign(appt, dto);
    return this.repo.save(appt);
  }

  async remove(id: string, user: User) {
    const appt = await this.repo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (appt.clientId !== user.id) throw new ForbiddenException();
    return this.repo.remove(appt);
  }
}
