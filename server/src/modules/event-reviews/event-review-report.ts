import type { EventReview } from './event-review.types';

interface EventReviewReportOptions {
  generatedAt: string;
  generatedBy: string;
}

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const displayTime = (value?: string) =>
  value ? value.replace('T', ' ').replace('.000Z', ' UTC') : '--';

const cell = (value: unknown) => `<td>${escapeHtml(value || '--')}</td>`;

export function renderEventReviewReport(review: EventReview, options: EventReviewReportOptions) {
  const timelineRows = review.timeline
    .map(
      (item) =>
        `<tr>${cell(item.time)}${cell(item.title)}${cell(item.detail)}${cell(item.status)}</tr>`,
    )
    .join('');
  const actionRows = review.actions
    .map(
      (action, index) =>
        `<tr>${cell(index + 1)}${cell(action.title)}${cell(action.ownerDepartment)}${cell(action.owner)}${cell(action.deadline)}${cell(action.priority)}${cell(action.status)}${cell(action.linkedHazardCode ? `${action.linkedHazardCode} / ${action.linkedHazardStatus}` : '未关联')}</tr>`,
    )
    .join('');
  const evidenceRows = review.evidence
    .map(
      (item, index) =>
        `<tr>${cell(index + 1)}${cell(item.name)}${cell(item.category)}${cell(item.note)}${cell(item.uploader)}${cell(displayTime(item.uploadedAt))}${cell(item.hash)}</tr>`,
    )
    .join('');
  const watermark = review.status === '已复盘' ? '' : '<div class="watermark">待归档</div>';
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(review.reviewCode)} 事件调查复盘报告</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17252d; font: 14px/1.65 "Noto Sans CJK SC","Microsoft YaHei",sans-serif; }
    h1 { margin: 0; font-size: 26px; letter-spacing: 2px; text-align: center; }
    h2 { margin: 24px 0 10px; padding-left: 10px; border-left: 4px solid #16758d; font-size: 18px; }
    .subtitle { margin: 6px 0 24px; color: #60727b; text-align: center; }
    .meta, table { width: 100%; border-collapse: collapse; }
    th, td { padding: 7px 8px; border: 1px solid #aebbc1; vertical-align: top; word-break: break-word; }
    th { background: #edf5f7; color: #264852; font-weight: 600; }
    .meta th { width: 14%; }
    .meta td { width: 36%; }
    .analysis { padding: 10px 12px; border: 1px solid #c8d3d7; border-radius: 4px; margin-bottom: 8px; }
    .analysis strong { display: block; color: #16758d; }
    .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #aebbc1; color: #60727b; font-size: 12px; }
    .watermark { position: fixed; top: 42%; left: 20%; z-index: -1; color: rgba(180,50,50,.09); font-size: 96px; transform: rotate(-25deg); }
    @media print { .watermark { position: fixed; } tr { break-inside: avoid; } }
  </style>
</head>
<body>
  ${watermark}
  <h1>事件调查复盘报告</h1>
  <p class="subtitle">${escapeHtml(review.reviewCode)} · ${escapeHtml(review.eventCode)}</p>
  <table class="meta">
    <tr><th>事件名称</th>${cell(review.eventTitle)}<th>所属区域</th>${cell(review.areaName)}</tr>
    <tr><th>复盘状态</th>${cell(review.status)}<th>复盘负责人</th>${cell(review.reviewer)}</tr>
    <tr><th>风险受控时间</th>${cell(displayTime(review.controlledAt))}<th>归档时间</th>${cell(displayTime(review.closedAt))}</tr>
    <tr><th>报告版本</th>${cell(`V${review.version}`)}<th>生成时间</th>${cell(displayTime(options.generatedAt))}</tr>
  </table>

  <h2>一、调查分析与经验反馈</h2>
  <div class="analysis"><strong>事件摘要</strong>${escapeHtml(review.summary || '待补充')}</div>
  <div class="analysis"><strong>直接原因</strong>${escapeHtml(review.directCause || '待补充')}</div>
  <div class="analysis"><strong>根本原因</strong>${escapeHtml(review.rootCause || '待补充')}</div>
  <div class="analysis"><strong>经验教训</strong>${escapeHtml(review.lesson || '待补充')}</div>

  <h2>二、全过程时间线</h2>
  <table><thead><tr><th>时间</th><th>节点</th><th>说明</th><th>状态</th></tr></thead><tbody>${timelineRows}</tbody></table>

  <h2>三、整改措施与隐患联动</h2>
  <table><thead><tr><th>序号</th><th>整改措施</th><th>责任部门</th><th>责任人</th><th>期限</th><th>优先级</th><th>状态</th><th>关联隐患</th></tr></thead><tbody>${actionRows}</tbody></table>

  <h2>四、调查证据目录</h2>
  <table><thead><tr><th>序号</th><th>文件名</th><th>类别</th><th>说明</th><th>上传人</th><th>上传时间</th><th>SHA-256</th></tr></thead><tbody>${evidenceRows || `<tr><td colspan="7">暂无调查证据</td></tr>`}</tbody></table>

  <p class="footer">报告由 QHSE 平台生成 · 导出人：${escapeHtml(options.generatedBy)} · 生成时间：${escapeHtml(displayTime(options.generatedAt))}</p>
</body>
</html>`;
  return {
    filename: `${review.reviewCode}-事件复盘报告.html`,
    contentType: 'text/html; charset=utf-8',
    body: Buffer.from(html, 'utf8'),
  };
}
