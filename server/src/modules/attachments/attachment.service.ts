import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { AttachmentRepository } from './attachment.repository';
import type { ObjectStorage } from './object-storage';
import type {
  AttachmentAccess,
  AttachmentBinding,
  AttachmentView,
  StoredObject,
} from './attachment.types';

export interface AttachmentUploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const allowedContentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const safeName = (name: string) => {
  const cleaned = name.replace(/[\r\n]/g, '').trim();
  const decoded = Buffer.from(cleaned, 'latin1').toString('utf8');
  const normalized =
    !decoded.includes('\uFFFD') && Buffer.from(decoded, 'utf8').toString('latin1') === cleaned
      ? decoded
      : cleaned;
  return normalized.slice(0, 240) || 'attachment';
};
const safeExtension = (name: string) => {
  const extension = extname(name).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
};

export class AttachmentService {
  constructor(
    private readonly repository: AttachmentRepository,
    private readonly storage: ObjectStorage,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID,
  ) {}

  async upload(file: AttachmentUploadFile | undefined, areaId: string, access: AttachmentAccess) {
    if (!file?.buffer?.length)
      throw new BadRequestException({
        code: 'ATTACHMENT_FILE_REQUIRED',
        message: '请选择附件文件',
      });
    this.checkArea(areaId, access);
    const maxSize = this.maxSize();
    if (file.size > maxSize || file.buffer.length > maxSize)
      throw new BadRequestException({
        code: 'ATTACHMENT_TOO_LARGE',
        message: `附件大小不能超过 ${Math.floor(maxSize / 1024 / 1024)} MB`,
      });
    if (!allowedContentTypes.has(file.mimetype))
      throw new BadRequestException({
        code: 'ATTACHMENT_TYPE_NOT_ALLOWED',
        message: '仅支持图片、PDF、文本及 Office 文档',
      });
    const id = this.createId();
    const now = this.now();
    const extension = safeExtension(file.originalname);
    const storageKey = `${now.toISOString().slice(0, 10).replace(/-/g, '/')}/${id}${extension}`;
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    await this.storage.put(storageKey, file.buffer, file.mimetype);
    const object: StoredObject = {
      id,
      storageKey,
      provider: this.storage.provider,
      bucket: this.storage.bucket,
      originalName: safeName(file.originalname),
      contentType: file.mimetype,
      size: file.buffer.length,
      sha256,
      uploaderId: access.actorId,
      uploader: access.actorName,
      areaId,
      status: 'uploaded',
      createdAt: now.toISOString(),
    };
    return this.view(await this.repository.create(object));
  }

  async metadata(id: string, allowedAreaIds?: string[]) {
    return this.view(await this.get(id, allowedAreaIds));
  }

  async content(id: string, allowedAreaIds?: string[]) {
    const object = await this.get(id, allowedAreaIds);
    return { object, body: await this.storage.read(object.storageKey) };
  }

  async bind(id: string, binding: Omit<AttachmentBinding, 'boundAt'>, access: AttachmentAccess) {
    this.checkArea(binding.areaId, access);
    const object = await this.get(id, access.allowedAreaIds);
    if (object.areaId !== binding.areaId) this.notFound();
    if (object.status === 'bound') {
      if (object.businessType === binding.businessType && object.businessId === binding.businessId)
        return object;
      throw new ConflictException({
        code: 'ATTACHMENT_ALREADY_BOUND',
        message: '附件已绑定其他业务记录',
      });
    }
    const boundAt = this.now().toISOString();
    const bound = await this.repository.bind(id, { ...binding, boundAt });
    if (bound) return bound;
    const concurrent = await this.get(id, access.allowedAreaIds);
    if (
      concurrent.businessType === binding.businessType &&
      concurrent.businessId === binding.businessId
    )
      return concurrent;
    throw new ConflictException({
      code: 'ATTACHMENT_ALREADY_BOUND',
      message: '附件已被其他操作绑定',
    });
  }

  private async get(id: string, allowedAreaIds?: string[]) {
    const object = await this.repository.findById(id);
    if (!object || (allowedAreaIds && !allowedAreaIds.includes(object.areaId))) this.notFound();
    return object;
  }

  private checkArea(areaId: string, access: AttachmentAccess) {
    if (access.allowedAreaIds && !access.allowedAreaIds.includes(areaId))
      throw new ForbiddenException({
        code: 'ATTACHMENT_AREA_FORBIDDEN',
        message: '无权访问该区域附件',
      });
  }

  private view(object: StoredObject): AttachmentView {
    return {
      id: object.id,
      originalName: object.originalName,
      contentType: object.contentType,
      size: object.size,
      sha256: object.sha256,
      uploader: object.uploader,
      areaId: object.areaId,
      businessType: object.businessType,
      businessId: object.businessId,
      status: object.status,
      createdAt: object.createdAt,
      boundAt: object.boundAt,
      downloadUrl: `/api/v1/attachments/${object.id}/content`,
    };
  }

  private maxSize() {
    const configured = Number(process.env.QHSE_ATTACHMENT_MAX_SIZE || 20 * 1024 * 1024);
    return Number.isFinite(configured) && configured > 0 ? configured : 20 * 1024 * 1024;
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'ATTACHMENT_NOT_FOUND', message: '附件不存在' });
  }
}
