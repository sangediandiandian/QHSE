/** @jest-environment node */

import { KnowledgeService } from './knowledge.service';

describe('KnowledgeService', () => {
  test('只检索已归档知识并按标题、编码和正文相关性排序', async () => {
    const reviews = {
      list: jest.fn(async () => [
        {
          id: 'review-closed',
          reviewCode: 'RP001',
          eventTitle: '高温泵法兰泄漏事件',
          areaId: 'area-02',
          areaName: '催化裂化装置',
          status: '已复盘',
          summary: '现场完成隔离。',
          directCause: '法兰垫片失效。',
          rootCause: '选型裕量不足。',
          lesson: '强化高温泵法兰检查。',
          actions: [{ title: '复核垫片选型' }],
          updatedAt: '2026-07-18T10:00:00.000Z',
        },
        {
          id: 'review-open',
          reviewCode: 'RP002',
          eventTitle: '泄漏调查中',
          areaId: 'area-02',
          status: '待关闭',
          actions: [],
          updatedAt: '2026-07-18T11:00:00.000Z',
        },
      ]),
    };
    const hazards = {
      list: jest.fn(async () => [
        {
          id: 'hazard-closed',
          code: 'YH001',
          title: '压力表标签整改',
          areaId: 'area-02',
          areaName: '催化裂化装置',
          status: '已关闭',
          category: '仪表管理',
          description: '复核法兰附近压力表。',
          measures: ['更换标签'],
          acceptanceOpinion: '验收合格',
          updatedAt: '2026-07-17T10:00:00.000Z',
        },
        {
          id: 'hazard-open',
          code: 'YH002',
          title: '法兰泄漏整改中',
          areaId: 'area-02',
          status: '整改中',
          measures: [],
          updatedAt: '2026-07-18T11:00:00.000Z',
        },
      ]),
    };
    const plans = {
      list: jest.fn(async () => [
        {
          id: 'plan-published',
          code: 'PLAN001',
          name: '可燃介质泄漏现场处置方案',
          category: '现场处置方案',
          eventType: '泄漏',
          applicableArea: '全厂',
          medium: '可燃介质',
          responseLevel: 'II级',
          triggerRule: '确认泄漏',
          notificationTargets: ['生产调度'],
          steps: ['切断泄漏源'],
          resources: ['堵漏工具'],
          ownerDepartment: 'QHSE 管理部',
          status: '生效中',
          publishStatus: '已发布',
          drills: [],
          updatedAt: '2026-07-16T10:00:00.000Z',
        },
        {
          id: 'plan-draft',
          code: 'PLAN002',
          name: '泄漏预案草稿',
          status: '已停用',
          publishStatus: '草稿',
          drills: [],
          updatedAt: '2026-07-18T11:00:00.000Z',
        },
      ]),
    };
    const service = new KnowledgeService(reviews as never, hazards as never, plans as never);

    const result = await service.search({ keyword: '法兰 泄漏', limit: 10 }, ['area-02']);

    expect(reviews.list).toHaveBeenCalledWith(['area-02']);
    expect(hazards.list).toHaveBeenCalledWith({}, ['area-02']);
    expect(result.items.map((item) => item.id)).toEqual([
      'review-closed',
      'plan-published',
      'hazard-closed',
    ]);
    expect(result.items[0]).toMatchObject({
      type: 'event_review',
      code: 'RP001',
      score: expect.any(Number),
    });
    expect(result.total).toBe(3);
  });

  test('支持知识类型筛选和结果上限', async () => {
    const service = new KnowledgeService(
      { list: jest.fn(async () => []) } as never,
      {
        list: jest.fn(async () => [
          {
            id: 'hazard-1',
            code: 'YH001',
            title: '消防通道整改',
            status: '已关闭',
            category: '消防安全',
            description: '清理消防通道',
            measures: ['清障'],
            updatedAt: '2026-07-18T10:00:00.000Z',
          },
        ]),
      } as never,
      { list: jest.fn(async () => []) } as never,
    );

    const result = await service.search({
      keyword: '消防',
      type: 'hazard',
      limit: 1,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('hazard');
  });
});
