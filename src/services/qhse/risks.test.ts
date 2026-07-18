/** @jest-environment node */

import { request } from '@umijs/max';
import { assessRiskUnit, reviewRiskAssessment, saveRiskControls } from './risks';

jest.mock('@umijs/max', () => ({ request: jest.fn() }));

const requestMock = request as jest.Mock;

describe('risk API client', () => {
  beforeEach(() => requestMock.mockReset());

  test('评估请求不发送可伪造的评估人并携带当前版本', async () => {
    const risk = { id: 'risk-001', version: 2 };
    requestMock.mockResolvedValue({ data: risk });

    await expect(
      assessRiskUnit(
        'risk-001',
        {
          likelihood: 10,
          exposure: 6,
          consequence: 7,
          assessor: '表单伪造姓名',
          basis: '现场复核',
        },
        1,
      ),
    ).resolves.toBe(risk);
    expect(requestMock).toHaveBeenCalledWith('/api/v1/risks/risk-001/assessments', {
      method: 'POST',
      data: {
        likelihood: 10,
        exposure: 6,
        consequence: 7,
        basis: '现场复核',
        expectedVersion: 1,
      },
    });
  });

  test('审批请求携带评估、决策和风险版本', async () => {
    const risk = { id: 'risk-001', version: 3 };
    requestMock.mockResolvedValue({ data: risk });

    await expect(
      reviewRiskAssessment('risk-001', 'assessment-1', 'reject', '依据不足', 2),
    ).resolves.toBe(risk);
    expect(requestMock).toHaveBeenCalledWith(
      '/api/v1/risks/risk-001/assessments/assessment-1/review',
      {
        method: 'PUT',
        data: {
          decision: 'reject',
          opinion: '依据不足',
          expectedVersion: 2,
        },
      },
    );
  });

  test('措施请求保留责任分工并携带当前版本', async () => {
    const risk = { id: 'risk-001', version: 3 };
    requestMock.mockResolvedValue({ data: risk });
    const controls = [{ content: '每班巡检', owner: '李建国', status: '有效' as const }];

    await expect(saveRiskControls('risk-001', controls, 2)).resolves.toBe(risk);
    expect(requestMock).toHaveBeenCalledWith('/api/v1/risks/risk-001/controls', {
      method: 'PUT',
      data: { controls, expectedVersion: 2 },
    });
  });
});
