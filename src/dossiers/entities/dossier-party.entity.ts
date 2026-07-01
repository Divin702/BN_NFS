import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Dossier } from './dossier.entity';
import { Client } from '../../clients/entities/client.entity';

@Entity('dossier_parties')
export class DossierParty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  dossierId: string;

  @ManyToOne(() => Dossier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dossierId' })
  dossier: Dossier;

  @Column({ nullable: true })
  clientId: string | null;

  @ManyToOne(() => Client, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientId' })
  client: Client | null;

  @Column({ type: 'varchar' })
  roleKey: string;

  @Column({ type: 'varchar' })
  roleLabel: string;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ type: 'varchar', nullable: true })
  signatureUrl: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  createdAt: Date;
}
