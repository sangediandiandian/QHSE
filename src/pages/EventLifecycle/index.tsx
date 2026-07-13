import type { EmergencyEvent, EmergencyEventAction, EmergencyEventStatus } from '@/types/qhse';
import { isEmergencyEventActionAllowed } from '@/utils/emergencyEventWorkflow';
import {
  AlertFilled,
  AuditOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  ControlFilled,
  HistoryOutlined,
  SafetyCertificateFilled,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Empty, Segmented, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const statusColor: Record<EmergencyEventStatus, string> = {
  待研判: 'gold', 响应中: 'red', 监控中: 'blue', 待关闭: 'purple', 已关闭: 'success',
};
const statusOrder: EmergencyEventStatus[] = ['待研判', '响应中', '监控中', '待关闭', '已关闭'];

function EventItem({ event, active, onSelect }: { event: EmergencyEvent; active: boolean; onSelect: () => void }) {
  return <button type="button" className={`${styles.eventItem} ${active ? styles.active : ''}`} onClick={onSelect}>
    <header><Tag color={statusColor[event.status]}>{event.status}</Tag><code>{event.code}</code><span>{event.source}</span></header>
    <strong>{event.title}</strong>
    <p>{event.areaName} · {event.ownerDepartment}</p>
    <footer><span><ClockCircleFilled /> {event.updatedAt}</span><em>{event.responseLevel}</em></footer>
  </button>;
}

function EventActions({ event, onAction }: { event: EmergencyEvent; onAction: (action: EmergencyEventAction) => void }) {
  if (event.status === '已关闭') return <div className={styles.closedTip}><CheckCircleFilled /> 事件已完成关闭审批并归档</div>;
  const actions: EmergencyEventAction[] = event.status === '响应中'
    ? ['升级响应', '降级响应', '终止响应']
    : event.status === '待研判' ? ['研判启动']
      : event.status === '监控中' ? ['申请关闭'] : ['审批关闭'];
  return <div className={styles.actions}>{actions.map((action) => <Button
    key={action}
    type={action === '终止响应' || action === '研判启动' || action === '申请关闭' || action === '审批关闭' ? 'primary' : 'default'}
    danger={action === '终止响应'}
    disabled={!isEmergencyEventActionAllowed(event, action)}
    onClick={() => onAction(action)}
  >{action === '研判启动' ? '研判并启动响应' : action}</Button>)}</div>;
}

export default function EventLifecycle() {
  const { dashboard, loading, loadDashboard, transitionEvent } = useModel('qhse');
  const [status, setStatus] = useState('全部');
  const [selectedId, setSelectedId] = useState('lifecycle-001');

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const events = useMemo(() => (dashboard?.emergencyEvents ?? []).filter((event) => status === '全部' || event.status === status), [dashboard, status]);
  const selected = dashboard?.emergencyEvents.find((event) => event.id === selectedId) ?? events[0];

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="事件生命周期数据暂不可用" /></PageContainer>;

  const responding = dashboard.emergencyEvents.filter((event) => event.status === '响应中').length;
  const monitoring = dashboard.emergencyEvents.filter((event) => event.status === '监控中' || event.status === '待关闭').length;
  const closed = dashboard.emergencyEvents.filter((event) => event.status === '已关闭').length;
  const handleAction = (action: EmergencyEventAction) => {
    if (!selected || !isEmergencyEventActionAllowed(selected, action)) return;
    transitionEvent(selected.id, action);
    message.success(`${selected.code} 已执行“${action}”`);
  };

  return <PageContainer title={false} className={styles.page}>
    <header className={styles.heading}>
      <div><span>INCIDENT LIFECYCLE CONTROL</span><h1>应急事件闭环</h1><p>从事件研判、响应调整、终止监控到关闭审批，全过程状态受控且操作留痕。</p></div>
      <div className={styles.guard}><SafetyCertificateFilled /><span>状态迁移受控<strong>操作记录本地持久化</strong><small>非法状态不允许执行</small></span></div>
    </header>

    <section className={styles.metrics}>
      <div><AuditOutlined /><span>事件总数<strong>{dashboard.emergencyEvents.length}</strong><small>统一事件台账</small></span></div>
      <div><AlertFilled /><span>响应中<strong>{responding}</strong><small>正在应急处置</small></span></div>
      <div><HistoryOutlined /><span>监控 / 待关闭<strong>{monitoring}</strong><small>等待稳定确认或审批</small></span></div>
      <div><CheckCircleFilled /><span>已关闭<strong>{closed}</strong><small>资料已归档</small></span></div>
    </section>

    <section className={styles.toolbar}><Segmented value={status} onChange={(value) => setStatus(String(value))} options={['全部', ...statusOrder]} /><span>显示 {events.length} / {dashboard.emergencyEvents.length} 个事件</span></section>

    <main className={styles.layout}>
      <section className={styles.catalog}>{events.map((event) => <EventItem key={event.id} event={event} active={selected?.id === event.id} onSelect={() => setSelectedId(event.id)} />)}{events.length === 0 && <Empty description="没有符合条件的事件" />}</section>
      {selected && <section className={styles.detail}>
        <header><div><code>{selected.code}</code><h2>{selected.title}</h2><p>{selected.summary}</p></div><Tag color={statusColor[selected.status]}>{selected.status}</Tag></header>
        <section className={styles.stateRail}>{statusOrder.map((item, index) => {
          const current = statusOrder.indexOf(selected.status);
          return <div key={item} className={index < current ? styles.done : index === current ? styles.current : ''}><i>{index < current ? '✓' : index + 1}</i><span>{item}</span></div>;
        })}</section>
        <dl><div><dt>响应等级</dt><dd>{selected.responseLevel}</dd></div><div><dt>事件区域</dt><dd>{selected.areaName}</dd></div><div><dt>现场指挥</dt><dd>{selected.commander}</dd></div><div><dt>责任部门</dt><dd>{selected.ownerDepartment}</dd></div></dl>
        <section className={styles.actionPanel}><div><ControlFilled /><span>当前可执行操作<small>状态与等级限制由工作流规则校验</small></span></div><EventActions event={selected} onAction={handleAction} /></section>
        <section className={styles.operations}><h3>操作留痕 <span>{selected.operations.length} 条</span></h3>{[...selected.operations].reverse().map((operation) => <article key={operation.id}>
          <i /><div><header><strong>{operation.action}</strong><time>{operation.operatedAt}</time></header><p>{operation.detail}</p><footer><span>{operation.operator}</span><em>{operation.fromStatus ? `${operation.fromStatus} → ` : ''}{operation.toStatus}</em><b>{operation.fromLevel && operation.fromLevel !== operation.toLevel ? `${operation.fromLevel} → ` : ''}{operation.toLevel}</b></footer></div>
        </article>)}</section>
      </section>}
    </main>
  </PageContainer>;
}
