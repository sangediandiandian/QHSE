import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { KnowledgeQueryDto } from './knowledge-query.dto';
import { KnowledgeService } from './knowledge.service';

const allowedAreas = (principal: AuthPrincipal) =>
  principal.dataScope === 'all' ? undefined : principal.areaIds;

@ApiTags('企业知识库')
@ApiBearerAuth()
@Controller('v1/knowledge')
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Get('search')
  @RequirePermissions('emergency:read', 'hazard:read', 'plan:read')
  search(@Query() query: KnowledgeQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.search(query, allowedAreas(principal));
  }
}
