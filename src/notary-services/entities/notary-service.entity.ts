import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('notary_services')
export class NotaryService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', default: 0 })
  officialFee: number;

  @Column({ type: 'varchar', nullable: true })
  linkedTemplateId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
