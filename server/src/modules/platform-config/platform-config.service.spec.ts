/** @jest-environment node */

import { BadRequestException, ConflictException } from '@nestjs/common';
import { InMemoryPlatformConfigRepository } from './in-memory-platform-config.repository';
import { PlatformConfigService } from './platform-config.service';

function createService() {
  let sequence = 0;
  return new PlatformConfigService(
    new InMemoryPlatformConfigRepository(),
    () => new Date('2026-07-15T08:00:00.000Z'),
    () => `config-${++sequence}`,
  );
}

const dictionaryInput = {
  code: 'permit_result',
  name: '作业票审批结果',
  description: '统一审批结果',
  items: [
    { value: 'rejected', label: '驳回', sort: 20, enabled: true },
    { value: 'approved', label: '通过', sort: 10, enabled: true, color: '#52c41a' },
  ],
  status: 'enabled' as const,
};

describe('PlatformConfigService', () => {
  test('创建字典并按排序号规范化字典项', async () => {
    const created = await createService().createDictionary(dictionaryInput);
    expect(created).toMatchObject({ id: 'config-1', code: 'permit_result', version: 1 });
    expect(created.items.map((item) => item.value)).toEqual(['approved', 'rejected']);
  });

  test('拒绝重复字典项值和重复配置编码', async () => {
    const service = createService();
    await expect(
      service.createDictionary({
        ...dictionaryInput,
        items: [
          { value: 'same', label: '一', sort: 1, enabled: true },
          { value: 'same', label: '二', sort: 2, enabled: true },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createDictionary({ ...dictionaryInput, code: 'hazard_category' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('字典更新执行编码不可变和乐观并发控制', async () => {
    const service = createService();
    const created = await service.createDictionary(dictionaryInput);
    const updated = await service.updateDictionary(created.id, {
      ...dictionaryInput,
      name: '审批结论',
      expectedVersion: 1,
    });
    expect(updated).toMatchObject({ name: '审批结论', version: 2 });
    await expect(
      service.updateDictionary(created.id, { ...dictionaryInput, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.updateDictionary(created.id, {
        ...dictionaryInput,
        code: 'changed_code',
        expectedVersion: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('集成登记拒绝协议不匹配和地址内嵌凭据', async () => {
    const service = createService();
    const base = {
      code: 'mes_gateway',
      name: 'MES 网关',
      type: 'telemetry' as const,
      protocol: 'HTTPS' as const,
      enabled: false,
      timeoutMs: 5000,
      owner: '信息中心',
    };
    await expect(
      service.createIntegration({ ...base, endpoint: 'http://mes.example.internal/api' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createIntegration({
        ...base,
        endpoint: 'https://admin:secret@mes.example.internal/api',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('创建和更新集成配置时重置健康状态', async () => {
    const service = createService();
    const input = {
      code: 'mes_gateway',
      name: 'MES 网关',
      type: 'telemetry' as const,
      protocol: 'HTTPS' as const,
      endpoint: 'https://mes.example.internal/api',
      enabled: false,
      timeoutMs: 5000,
      owner: '信息中心',
    };
    const created = await service.createIntegration(input);
    expect(created).toMatchObject({ healthStatus: 'unchecked', version: 1 });
    const updated = await service.updateIntegration(created.id, {
      ...input,
      enabled: true,
      expectedVersion: 1,
    });
    expect(updated).toMatchObject({ enabled: true, healthStatus: 'unchecked', version: 2 });
  });
});
