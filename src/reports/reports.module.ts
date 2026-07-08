import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dossier } from '../dossiers/entities/dossier.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/entities/user.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Dossier, Client, User])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
