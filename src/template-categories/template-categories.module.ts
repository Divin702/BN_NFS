import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateCategory } from './entities/template-category.entity';
import { TemplateCategoriesService } from './template-categories.service';
import { TemplateCategoriesController } from './template-categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TemplateCategory])],
  controllers: [TemplateCategoriesController],
  providers: [TemplateCategoriesService],
  exports: [TemplateCategoriesService],
})
export class TemplateCategoriesModule {}
