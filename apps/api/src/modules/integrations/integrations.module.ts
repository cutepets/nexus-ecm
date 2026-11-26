import { Module } from '@nestjs/common';
import { IntegrationAdminController, IntegrationDataController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({ controllers: [IntegrationAdminController, IntegrationDataController], providers: [IntegrationsService] })
export class IntegrationsModule {}
