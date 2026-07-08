import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { TemplateCategoriesModule } from './template-categories/template-categories.module';
import { DocumentTemplatesModule } from './document-templates/document-templates.module';
import { ClientsModule } from './clients/clients.module';
import { DossiersModule } from './dossiers/dossiers.module';
import { NotaryServicesModule } from './notary-services/notary-services.module';
import { RequestsModule } from './requests/requests.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    MailModule,
    TemplateCategoriesModule,
    DocumentTemplatesModule,
    ClientsModule,
    DossiersModule,
    NotaryServicesModule,
    RequestsModule,
    AppointmentsModule,
    ReportsModule,
  ],
})
export class AppModule {}
