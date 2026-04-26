import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';
import { TemplateCategory } from '../template-categories/entities/template-category.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  entities: [User, TemplateCategory],
  synchronize: true,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('Connected to database');

  const repo = AppDataSource.getRepository(User);

  // Seed super admin
  const existing = await repo.findOne({
    where: { email: 'Idivin702@gmail.com' },
  });
  if (existing) {
    existing.password = await bcrypt.hash('Password123?', 12);
    await repo.save(existing);
    console.log('Super admin password updated');
  } else {
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
    console.log('Super admin seeded successfully!');
    console.log('   Email    : Idivin702@gmail.com');
    console.log('   Password : Password123?');
    console.log('   Role     : ADMINISTRATOR');
  }

  // Seed default template categories
  const catRepo = AppDataSource.getRepository(TemplateCategory);
  const defaultCategories = [
    {
      name: 'Real Estate',
      slug: 'real-estate',
      description: 'Notarial acts related to property transactions',
    },
    {
      name: 'Civil Status',
      slug: 'civil-status',
      description: 'Acts related to birth, marriage, and civil records',
    },
    {
      name: 'Commercial',
      slug: 'commercial',
      description: 'Business and commercial legal documents',
    },
    {
      name: 'Power of Attorney',
      slug: 'power-of-attorney',
      description: 'Authorization and proxy documents',
    },
  ];

  for (const cat of defaultCategories) {
    const exists = await catRepo.findOne({ where: { slug: cat.slug } });
    if (!exists) {
      await catRepo.save(catRepo.create(cat));
      console.log(`Category seeded: ${cat.name}`);
    } else {
      console.log(`Category already exists: ${cat.name}`);
    }
  }

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
