import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { UploadAttachmentDto } from './attachment.dto';
import { AttachmentService, type AttachmentUploadFile } from './attachment.service';

const areas = (principal: AuthPrincipal) =>
  principal.dataScope === 'all' ? undefined : principal.areaIds;
const access = (principal: AuthPrincipal) => ({
  actorId: principal.userId,
  actorName: principal.name,
  allowedAreaIds: areas(principal),
});

@ApiTags('附件与对象存储')
@ApiBearerAuth()
@Controller('v1/attachments')
export class AttachmentController {
  constructor(private readonly service: AttachmentService) {}

  @Post()
  @RequirePermissions('attachment:upload')
  @AuditAction({ action: 'attachment.upload', resourceType: 'attachment' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'areaId'],
      properties: { file: { type: 'string', format: 'binary' }, areaId: { type: 'string' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  upload(
    @UploadedFile() file: AttachmentUploadFile | undefined,
    @Body() input: UploadAttachmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.upload(file, input.areaId, access(principal));
  }

  @Get(':id')
  @RequirePermissions('attachment:read')
  metadata(@Param('id') id: string, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.metadata(id, areas(principal));
  }

  @Get(':id/content')
  @RequirePermissions('attachment:read')
  async content(
    @Param('id') id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { object, body } = await this.service.content(id, areas(principal));
    response.setHeader('Content-Type', object.contentType);
    response.setHeader('Content-Length', String(body.length));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, max-age=3600, immutable');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(object.originalName)}`,
    );
    return new StreamableFile(body);
  }
}
