import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dossier } from './entities/dossier.entity';
import { DossiersService } from './dossiers.service';
import { DossiersController } from './dossiers.controller';
import { NotaryService } from '../notary-services/entities/notary-service.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Dossier, NotaryService])],
  controllers: [DossiersController],
  providers: [DossiersService],
  exports: [DossiersService],
})
export class DossiersModule {}
