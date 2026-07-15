/** @jest-environment node */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AttachmentService } from './attachment.service';
import { InMemoryAttachmentRepository } from './in-memory-attachment.repository';
import type { ObjectStorage } from './object-storage';

class MemoryObjectStorage implements ObjectStorage {
  readonly provider = 'local' as const;
  readonly bucket = 'test';
  readonly objects = new Map<string, Buffer>();

  async put(key: string, body: Buffer) {
    this.objects.set(key, Buffer.from(body));
  }

  async read(key: string) {
    const body = this.objects.get(key);
    if (!body) throw new Error('OBJECT_NOT_FOUND');
    return Buffer.from(body);
  }
}

const qhse = { actorId: 'user-qhse', actorName: '赵磊' };
const operator = {
  actorId: 'user-operator',
  actorName: '王强',
  allowedAreaIds: ['area-02'],
};

function createService() {
  const storage = new MemoryObjectStorage();
  const service = new AttachmentService(
    new InMemoryAttachmentRepository(),
    storage,
    () => new Date('2026-07-15T08:00:00.000Z'),
    () => '00000000-0000-4000-8000-000000000001',
  );
  return { service, storage };
}

describe('AttachmentService', () => {
  test('上传文件并生成可信元数据和可读取内容', async () => {
    const { service, storage } = createService();
    const body = Buffer.from('verified evidence');
    const uploaded = await service.upload(
      {
        originalname: Buffer.from('整改报告.pdf', 'utf8').toString('latin1'),
        mimetype: 'application/pdf',
        size: body.length,
        buffer: body,
      },
      'area-02',
      operator,
    );

    expect(uploaded).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      originalName: '整改报告.pdf',
      areaId: 'area-02',
      status: 'uploaded',
      sha256: createHash('sha256').update(body).digest('hex'),
      downloadUrl: '/api/v1/attachments/00000000-0000-4000-8000-000000000001/content',
    });
    expect(storage.objects.size).toBe(1);
    await expect(service.content(uploaded.id, ['area-02'])).resolves.toMatchObject({ body });
  });

  test('按账号区域限制上传和读取且不泄露对象存在性', async () => {
    const { service } = createService();
    await expect(
      service.upload(
        {
          originalname: '现场记录.txt',
          mimetype: 'text/plain',
          size: 4,
          buffer: Buffer.from('test'),
        },
        'area-01',
        operator,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const uploaded = await service.upload(
      {
        originalname: '现场记录.txt',
        mimetype: 'text/plain',
        size: 4,
        buffer: Buffer.from('test'),
      },
      'area-01',
      qhse,
    );
    await expect(service.metadata(uploaded.id, ['area-02'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test('附件只能绑定一条业务记录，同一绑定保持幂等', async () => {
    const { service } = createService();
    const uploaded = await service.upload(
      {
        originalname: 'evidence.png',
        mimetype: 'image/png',
        size: 3,
        buffer: Buffer.from('png'),
      },
      'area-02',
      operator,
    );
    const binding = {
      businessType: 'hazard' as const,
      businessId: 'hazard-003',
      areaId: 'area-02',
    };
    await expect(service.bind(uploaded.id, binding, operator)).resolves.toMatchObject({
      status: 'bound',
      ...binding,
    });
    await expect(service.bind(uploaded.id, binding, operator)).resolves.toMatchObject(binding);
    await expect(
      service.bind(
        uploaded.id,
        { businessType: 'emergency_event', businessId: 'event-001', areaId: 'area-02' },
        operator,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('拒绝空文件和非白名单文件类型', async () => {
    const { service } = createService();
    await expect(service.upload(undefined, 'area-02', operator)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.upload(
        {
          originalname: 'script.svg',
          mimetype: 'image/svg+xml',
          size: 6,
          buffer: Buffer.from('<svg/>'),
        },
        'area-02',
        operator,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
