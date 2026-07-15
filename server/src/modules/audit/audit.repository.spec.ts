/** @jest-environment node */

import { InMemoryAuditRepository } from './in-memory-audit.repository';

describe('InMemoryAuditRepository', () => {
  test('按行为和结果筛选审计记录', async () => {
    const repository = new InMemoryAuditRepository();
    await repository.create({
      id: 'audit-1',
      requestId: 'request-1',
      actorId: 'user-qhse',
      actorName: '赵磊',
      action: 'risk.assess',
      resourceType: 'risk',
      resourceId: 'risk-001',
      result: 'success',
      method: 'POST',
      path: '/api/v1/risks/risk-001/assessments',
      durationMs: 12,
      createdAt: new Date('2026-07-14T08:00:00Z'),
    });
    await expect(repository.findAll({ action: 'risk', result: 'success' }))
      .resolves.toHaveLength(1);
    await expect(repository.findAll({ result: 'failure' })).resolves.toHaveLength(0);
  });
});
