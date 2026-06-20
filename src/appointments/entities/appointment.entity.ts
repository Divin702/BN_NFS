import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AppointmentStatus {
  PENDING   = 'pending',
  CONFIRMED = 'confirmed',
  DECLINED  = 'declined',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: User;

  @Column()
  notaryId: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notaryId' })
  notary: User;

  @Column({ type: 'date' })
  requestedDate: string;

  @Column()
  requestedTime: string;

  @Column({ nullable: true })
  location: string;

  @Column()
  purpose: string;

  @Column({ type: 'text', nullable: true })
  clientNotes: string;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  documentUrls: string[];

  @Column({ type: 'text', nullable: true })
  notaryNotes: string;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.PENDING })
  status: AppointmentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
