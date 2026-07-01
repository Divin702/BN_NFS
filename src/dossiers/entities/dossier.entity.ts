import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../users/entities/user.entity';
import { DossierParty } from './dossier-party.entity';

export enum DossierStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

@Entity('dossiers')
export class Dossier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  number: string;

  @ManyToOne(() => Client, { eager: true, nullable: true })
  @JoinColumn({ name: 'clientId' })
  client: Client | null;

  @Column({ nullable: true })
  clientId: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'assignedNotaryId' })
  assignedNotary: User | null;

  @Column({ nullable: true })
  assignedNotaryId: string | null;

  @Column({ type: 'varchar', nullable: true })
  serviceType: string | null;

  @Column({ type: 'enum', enum: DossierStatus, default: DossierStatus.OPEN })
  status: DossierStatus;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  templateFields: Record<string, string> | null;

  @Column({ type: 'jsonb', default: [] })
  documents: { name: string; url: string; uploadedAt: string }[];

  @Column({ type: 'jsonb', default: [] })
  statusHistory: {
    status: string;
    changedAt: string;
    changedById: string;
    changedByName: string;
  }[];

  @Column({ type: 'varchar', nullable: true })
  serviceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  serviceName: string | null;

  @Column({ type: 'integer', nullable: true })
  officialFee: number | null;

  @Column({ type: 'integer', nullable: true })
  notaryFee: number | null;

  @Column({ type: 'integer', nullable: true })
  totalFee: number | null;

  @Column({ type: 'varchar', nullable: true })
  notarySignatureUrl: string | null;

  @OneToMany(() => DossierParty, (p) => p.dossier, { cascade: true, eager: false })
  parties: DossierParty[];

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
