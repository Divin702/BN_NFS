import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotaryService } from './entities/notary-service.entity';
import { NotaryServicesService } from './notary-services.service';
import { NotaryServicesController } from './notary-services.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NotaryService])],
  controllers: [NotaryServicesController],
  providers: [NotaryServicesService],
  exports: [NotaryServicesService],
})
export class NotaryServicesModule {}
