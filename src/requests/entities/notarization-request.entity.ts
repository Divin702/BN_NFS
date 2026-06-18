import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum RequestStatus {
  PENDING   = 'pending',
  ACCEPTED  = 'accepted',
  DECLINED  = 'declined',
  COMPLETED = 'completed',
}

@Entity('notarization_requests')
export class NotarizationRequest {
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

  @Column()
  documentType: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  attachmentUrl: string;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.PENDING })
  status: RequestStatus;

  @Column({ type: 'text', nullable: true })
  notaryNotes: string;

  @Column({ nullable: true })
  notaryDocumentUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
