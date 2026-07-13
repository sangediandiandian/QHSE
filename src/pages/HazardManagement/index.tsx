import type { Hazard, HazardStatus } from '@/types/qhse';
import { CheckCircleFilled, ClockCircleFilled, ExclamationCircleFilled, SearchOutlined, WarningFilled } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Empty, Input, Segmented, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const statusColor: Record<HazardStatus, string> = { 待整改: 'error', 整改中: 'processing', 待验收: 'warning', 已关闭: 'success' };
const actionText: Record<HazardStatus, string> = { 待整改: '开始整改', 整改中: '提交验收', 待验收: '验收关闭', 已关闭: '已关闭' };

function HazardRow({ hazard, onAdvance }: { hazard: Hazard; onAdvance: () => void }) {
  return <article className={hazard.overdue && hazard.status !== '已关闭' ? styles.overdue : ''}>
    <div><code>{hazard.code}</code><strong>{hazard.title}</strong><small><Tag bordered={false}>{hazard.source}</Tag>{hazard.description}</small></div>
    <div><strong>{hazard.areaName}</strong><small>{hazard.category}</small></div>
    <div><Tag color={hazard.level === '重大' ? 'error' : hazard.level === '较大' ? 'orange' : 'default'}>{hazard.level}</Tag>{hazard.recurrenceCount > 0 && <small>复发 {hazard.recurrenceCount} 次</small>}</div>
    <div><strong>{hazard.owner}</strong><small>{hazard.ownerDepartment}</small></div>
    <div><strong>{hazard.deadline}</strong><small className={hazard.overdue ? styles.red : ''}>{hazard.overdue && hazard.status !== '已关闭' ? '已逾期' : `发现 ${hazard.discoveredAt}`}</small></div>
    <div><Tag color={statusColor[hazard.status]}>{hazard.status}</Tag></div>
    <Button size="small" type={hazard.status === '待验收' ? 'primary' : 'default'} disabled={hazard.status === '已关闭'} onClick={onAdvance}>{actionText[hazard.status]}</Button>
  </article>;
}

export default function HazardManagement() {
  const { dashboard, loading, loadDashboard, advanceHazard } = useModel('qhse');
  const [status, setStatus] = useState('全部');
  const [query, setQuery] = useState('');

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const hazards = useMemo(() => (dashboard?.hazards ?? []).filter((hazard) => {
    const keyword = query.trim().toLowerCase();
    return (status === '全部' || hazard.status === status)
      && (!keyword || `${hazard.title}${hazard.code}${hazard.areaName}${hazard.owner}`.toLowerCase().includes(keyword));
  }), [dashboard, query, status]);

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="隐患数据暂不可用" /></PageContainer>;

  const open = dashboard.hazards.filter((item) => item.status !== '已关闭').length;
  const overdue = dashboard.hazards.filter((item) => item.overdue && item.status !== '已关闭').length;
  const major = dashboard.hazards.filter((item) => item.level === '重大' && item.status !== '已关闭').length;
  const closed = dashboard.hazards.filter((item) => item.status === '已关闭').length;

  return (
    <PageContainer title={false} className={styles.page}>
      <header className={styles.heading}><div><span>HAZARD CLOSED-LOOP CONTROL</span><h1>隐患排查治理</h1><p>将现场检查、预警和事件复盘统一转化为责任明确、过程可追踪的整改闭环。</p></div><div className={styles.rate}><CheckCircleFilled /><span>隐患闭环率<strong>{Math.round(closed / dashboard.hazards.length * 100)}%</strong><small>{closed} / {dashboard.hazards.length} 项已关闭</small></span></div></header>

      <section className={styles.metrics}>
        <div><ClockCircleFilled /><span>未闭环<strong>{open}</strong><small>当前整改任务</small></span></div>
        <div className={styles.danger}><WarningFilled /><span>重大隐患<strong>{major}</strong><small>挂牌重点督办</small></span></div>
        <div className={overdue ? styles.warning : ''}><ExclamationCircleFilled /><span>逾期未完成<strong>{overdue}</strong><small>已触发超期提醒</small></span></div>
        <div><CheckCircleFilled /><span>已关闭<strong>{closed}</strong><small>证据完成归档</small></span></div>
      </section>

      <section className={styles.toolbar}><Segmented value={status} onChange={(value) => setStatus(String(value))} options={['全部', '待整改', '整改中', '待验收', '已关闭']} /><Input allowClear prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索隐患、区域、责任人" /><span>显示 {hazards.length} / {dashboard.hazards.length} 项</span></section>

      <section className={styles.table}>
        <header><span>隐患与来源</span><span>区域 / 类别</span><span>等级</span><span>责任</span><span>期限</span><span>状态</span><span>操作</span></header>
        {hazards.map((hazard) => <HazardRow key={hazard.id} hazard={hazard} onAdvance={() => {
          advanceHazard(hazard.id);
          message.success(`${hazard.code}：${actionText[hazard.status]}已完成`);
        }} />)}
        {hazards.length === 0 && <Empty description="没有符合条件的隐患" />}
      </section>
    </PageContainer>
  );
}
