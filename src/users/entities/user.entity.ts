import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from '../enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  nationalId: string;

  @Column({ unique: true })
  phoneNumber: string;

  @Column({ nullable: true })
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.CITIZEN })
  role: Role;

  @Column({ nullable: true })
  organization: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  picture: string;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: false })
  isDisabled: boolean;

  @Column({ type: 'varchar', nullable: true, unique: true })
  invitationToken: string | null;

  @Column({ nullable: true })
  invitationExpiresAt: Date;

  @Column({ default: false })
  invitationAccepted: boolean;

  @Column({ nullable: true })
  lastActiveAt: Date;

  @Column({ type: 'varchar', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2')) {
      this.password = await bcrypt.hash(this.password, 12);
    }
  }

  async validatePassword(plain: string): Promise<boolean> {
    return bcrypt.compare(plain, this.password);
  }
}
