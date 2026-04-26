import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  entities: [User],
  synchronize: true,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Connected to database');

  const repo = AppDataSource.getRepository(User);

  const existing = await repo.findOne({ where: { email: 'Idivin702@gmail.com' } });
  if (existing) {
    existing.password = await bcrypt.hash('Password123?', 12);
    await repo.save(existing);
    console.log('✅ Super admin password updated to: Password123?');
    await AppDataSource.destroy();
    return;
  }

  const password = await bcrypt.hash('Password123?', 12);

  const admin = repo.create({
    firstName: 'Irakoze',
    lastName: 'Divin',
    email: 'Idivin702@gmail.com',
    nationalId: 'ADMIN000000001',
    phoneNumber: '+250784567611',
    password,
    role: Role.ADMINISTRATOR,
    isActive: true,
    invitationAccepted: true,
  });

  await repo.save(admin);
  console.log('🌱 Super admin seeded successfully!');
  console.log('   Email    : Idivin702@gmail.com');
  console.log('   Password : Password123?');
  console.log('   Role     : ADMINISTRATOR');
  console.log('   ⚠️  Change the password after first login!');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
