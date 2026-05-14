import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { TemplateCategory } from '../../template-categories/entities/template-category.entity';
import { User } from '../../users/entities/user.entity';
import { TemplateStatus } from '../enums/template-status.enum';

@Entity('document_templates')
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  templateCode: string;

  @Column({ default: '1.0.0' })
  version: string;

  @Column({ nullable: true })
  shortDescription: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ type: 'enum', enum: TemplateStatus, default: TemplateStatus.DRAFT })
  status: TemplateStatus;

  @Column({ nullable: true })
  categoryId: string;

  @ManyToOne(() => TemplateCategory, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: TemplateCategory;

  @Column({ nullable: true })
  createdById: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'jsonb', default: [] })
  fields: { key: string; label: string; required: boolean }[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
