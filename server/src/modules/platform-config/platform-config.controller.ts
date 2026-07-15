import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import {
  CreateDictionaryDto,
  CreateIntegrationDto,
  UpdateDictionaryDto,
  UpdateIntegrationDto,
} from './platform-config.dto';
import { PlatformConfigService } from './platform-config.service';

@ApiTags('平台配置')
@ApiBearerAuth()
@Controller('v1/platform-config')
export class PlatformConfigController {
  constructor(private readonly service: PlatformConfigService) {}

  @Get('dictionaries')
  @RequirePermissions('config:read')
  dictionaries() {
    return this.service.listDictionaries();
  }

  @Post('dictionaries')
  @RequirePermissions('config:manage')
  @AuditAction({ action: 'config.dictionary.create', resourceType: 'platform_dictionary' })
  createDictionary(@Body() input: CreateDictionaryDto) {
    return this.service.createDictionary(input);
  }

  @Put('dictionaries/:id')
  @RequirePermissions('config:manage')
  @AuditAction({ action: 'config.dictionary.update', resourceType: 'platform_dictionary' })
  updateDictionary(@Param('id') id: string, @Body() input: UpdateDictionaryDto) {
    return this.service.updateDictionary(id, input);
  }

  @Get('integrations')
  @RequirePermissions('config:read')
  integrations() {
    return this.service.listIntegrations();
  }

  @Post('integrations')
  @RequirePermissions('config:manage')
  @AuditAction({ action: 'config.integration.create', resourceType: 'integration_config' })
  createIntegration(@Body() input: CreateIntegrationDto) {
    return this.service.createIntegration(input);
  }

  @Put('integrations/:id')
  @RequirePermissions('config:manage')
  @AuditAction({ action: 'config.integration.update', resourceType: 'integration_config' })
  updateIntegration(@Param('id') id: string, @Body() input: UpdateIntegrationDto) {
    return this.service.updateIntegration(id, input);
  }
}
