/** @jest-environment node */

import { eventReviewSeed } from './event-review.seed';
import { renderEventReviewReport } from './event-review-report';

describe('renderEventReviewReport', () => {
  test('生成包含调查结论、时间线、整改和证据目录的可打印报告', () => {
    const report = renderEventReviewReport(
      {
        ...eventReviewSeed[0],
        summary: '<script>alert("xss")</script>',
        actions: [
          {
            ...eventReviewSeed[0].actions[2],
            linkedHazardCode: 'YH20260718001',
            linkedHazardStatus: '整改中',
          },
        ],
        evidence: [
          {
            id: 'evidence-1',
            objectId: 'object-1',
            name: '调查报告.pdf',
            category: '调查报告',
            note: '材料分析',
            uploaderId: 'user-qhse',
            uploader: '赵磊',
            uploadedAt: '2026-07-18T12:00:00.000Z',
            hash: 'sha256-value',
          },
        ],
      },
      {
        generatedAt: '2026-07-18T13:00:00.000Z',
        generatedBy: '赵磊',
      },
    );
    const html = report.body.toString('utf8');

    expect(report).toMatchObject({
      filename: 'RP20260711001-事件复盘报告.html',
      contentType: 'text/html; charset=utf-8',
    });
    expect(html).toContain('事件调查复盘报告');
    expect(html).toContain('全过程时间线');
    expect(html).toContain('YH20260718001');
    expect(html).toContain('调查报告.pdf');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert');
  });
});
