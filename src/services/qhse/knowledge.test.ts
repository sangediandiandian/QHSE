/** @jest-environment node */

import { request } from '@umijs/max';
import { searchKnowledge } from './knowledge';

jest.mock('@umijs/max', () => ({ request: jest.fn() }));

const requestMock = request as jest.Mock;

test('知识库检索提交关键词、类型和结果上限', async () => {
  const result = { keyword: '法兰泄漏', total: 1, items: [{ id: 'review-1' }] };
  requestMock.mockResolvedValue({ data: result });

  await expect(
    searchKnowledge({ keyword: '法兰泄漏', type: 'event_review', limit: 10 }),
  ).resolves.toBe(result);
  expect(requestMock).toHaveBeenCalledWith('/api/v1/knowledge/search', {
    method: 'GET',
    params: { keyword: '法兰泄漏', type: 'event_review', limit: 10 },
  });
});
