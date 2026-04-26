import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { TemplateCategoriesModule } from './template-categories/template-categories.module';
import { DocumentTemplatesModule } from './document-templates/document-templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    MailModule,
    TemplateCategoriesModule,
    DocumentTemplatesModule,
  ],
})
export class AppModule {}
