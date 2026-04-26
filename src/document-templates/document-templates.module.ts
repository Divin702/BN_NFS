import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentTemplate } from './entities/document-template.entity';
import { DocumentTemplatesService } from './document-templates.service';
import { DocumentTemplatesController } from './document-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentTemplate])],
  controllers: [DocumentTemplatesController],
  providers: [DocumentTemplatesService],
  exports: [DocumentTemplatesService],
})
export class DocumentTemplatesModule {}
