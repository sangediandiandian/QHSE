import type { EmergencyEvent, EmergencyEventAction, EmergencyEventEvidence, EmergencyEventStatus } from '@/types/qhse';
import { isEmergencyApprovalOverdue, isEmergencyEventActionAllowed } from '@/utils/emergencyEventWorkflow';
import {
  AlertFilled,
  AuditOutlined,
  BellFilled,
  CheckCircleFilled,
  ClockCircleFilled,
  ControlFilled,
  HistoryOutlined,
  PaperClipOutlined,
  SafetyCertificateFilled,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Empty, Form, Input, Modal, Segmented, Select, Skeleton, Space, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const statusColor: Record<EmergencyEventStatus, string> = {
  待研判: 'gold', 响应中: 'red', 监控中: 'blue', 待关闭: 'purple', 已关闭: 'success',
};
const statusOrder: EmergencyEventStatus[] = ['待研判', '响应中', '监控中', '待关闭', '已关闭'];

function getCurrentTimestamp() {
  const date = new Date();
  const values = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, '0'));
  return `${values[0]}-${values[1]}-${values[2]} ${values[3]}:${values[4]}:${values[5]}`;
}

function EventItem({ event, active, onSelect }: { event: EmergencyEvent; active: boolean; onSelect: () => void }) {
  const overdue = isEmergencyApprovalOverdue(event, getCurrentTimestamp());
  return <button type="button" className={`${styles.eventItem} ${active ? styles.active : ''} ${overdue ? styles.overdue : ''}`} onClick={onSelect}>
    <header><Tag color={statusColor[event.status]}>{event.status}</Tag>{overdue && <Tag color="error">审批超时</Tag>}<code>{event.code}</code><span>{event.source}</span></header>
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
  const { dashboard, loading, loadDashboard, transitionEvent, addEmergencyEventEvidence, remindEmergencyClosureApproval, approveEmergencyEventClosure } = useModel('qhse');
  const [status, setStatus] = useState('全部');
  const [selectedId, setSelectedId] = useState('lifecycle-001');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [evidenceForm] = Form.useForm<Omit<EmergencyEventEvidence, 'id' | 'uploadedAt' | 'hash'>>();
  const [approvalForm] = Form.useForm<{ opinion: string }>();

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const events = useMemo(() => (dashboard?.emergencyEvents ?? []).filter((event) => status === '全部' || event.status === status), [dashboard, status]);
  const selected = dashboard?.emergencyEvents.find((event) => event.id === selectedId) ?? events[0];

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="事件生命周期数据暂不可用" /></PageContainer>;

  const responding = dashboard.emergencyEvents.filter((event) => event.status === '响应中').length;
  const monitoring = dashboard.emergencyEvents.filter((event) => event.status === '监控中' || event.status === '待关闭').length;
  const closed = dashboard.emergencyEvents.filter((event) => event.status === '已关闭').length;
  const overdueApprovals = dashboard.emergencyEvents.filter((event) => isEmergencyApprovalOverdue(event, getCurrentTimestamp())).length;
  const handleAction = (action: EmergencyEventAction) => {
    if (!selected || !isEmergencyEventActionAllowed(selected, action)) return;
    if (action === '审批关闭') {
      if (!selected.evidence?.length) {
        setEvidenceOpen(true);
        message.warning('至少归档一项事件证据后才能审批关闭');
        return;
      }
      approvalForm.setFieldsValue({ opinion: '处置任务已完成，监测数据稳定，证据齐全，同意关闭并归档。' });
      setApprovalOpen(true);
      return;
    }
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
      <div className={overdueApprovals ? styles.warningMetric : ''}><BellFilled /><span>超时审批<strong>{overdueApprovals}</strong><small>可记录催办轨迹</small></span></div>
      <div><CheckCircleFilled /><span>已关闭<strong>{closed}</strong><small>资料已归档</small></span></div>
    </section>

    <section className={styles.toolbar}><Segmented value={status} onChange={(value) => setStatus(String(value))} options={['全部', ...statusOrder]} /><span>显示 {events.length} / {dashboard.emergencyEvents.length} 个事件</span></section>

    <main className={styles.layout}>
      <section className={styles.catalog}>{events.map((event) => <EventItem key={event.id} event={event} active={selected?.id === event.id} onSelect={() => setSelectedId(event.id)} />)}{events.length === 0 && <Empty description="没有符合条件的事件" />}</section>
      {selected && <section className={styles.detail}>
        <header><div><code>{selected.code}</code><h2>{selected.title}</h2><p>{selected.summary}</p></div><Space><Button icon={<PaperClipOutlined />} onClick={() => setEvidenceOpen(true)}>添加证据</Button><Tag color={statusColor[selected.status]}>{selected.status}</Tag></Space></header>
        <section className={styles.stateRail}>{statusOrder.map((item, index) => {
          const current = statusOrder.indexOf(selected.status);
          return <div key={item} className={index < current ? styles.done : index === current ? styles.current : ''}><i>{index < current ? '✓' : index + 1}</i><span>{item}</span></div>;
        })}</section>
        <dl><div><dt>响应等级</dt><dd>{selected.responseLevel}</dd></div><div><dt>事件区域</dt><dd>{selected.areaName}</dd></div><div><dt>现场指挥</dt><dd>{selected.commander}</dd></div><div><dt>责任部门</dt><dd>{selected.ownerDepartment}</dd></div></dl>
        <section className={styles.actionPanel}><div><ControlFilled /><span>当前可执行操作<small>状态与等级限制由工作流规则校验</small></span></div><EventActions event={selected} onAction={handleAction} /></section>
        <section className={styles.businessGrid}>
          <div className={styles.evidence}><h3>事件证据 <span>{selected.evidence?.length ?? 0} 项</span></h3>{selected.evidence?.length ? selected.evidence.map((item) => <article key={item.id}><Tag>{item.category}</Tag><strong>{item.name}</strong><small>{item.uploader} · {item.uploadedAt}</small><p>{item.note}</p><code>{item.hash}</code></article>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无归档证据" />}</div>
          <div className={`${styles.approval} ${isEmergencyApprovalOverdue(selected, getCurrentTimestamp()) ? styles.approvalOverdue : ''}`}><h3>关闭审批任务</h3>{selected.closureApproval ? <><header><Tag color={selected.closureApproval.status === '已通过' ? 'success' : isEmergencyApprovalOverdue(selected, getCurrentTimestamp()) ? 'error' : 'processing'}>{selected.closureApproval.status === '已通过' ? '已通过' : isEmergencyApprovalOverdue(selected, getCurrentTimestamp()) ? '已超时' : '待审批'}</Tag><strong>{selected.closureApproval.assignee}</strong></header><dl><div><dt>申请人</dt><dd>{selected.closureApproval.applicant}</dd></div><div><dt>审批时限</dt><dd>{selected.closureApproval.dueAt}</dd></div><div><dt>催办</dt><dd>{selected.closureApproval.reminderCount} 次{selected.closureApproval.lastReminderAt ? ` · ${selected.closureApproval.lastReminderAt}` : ''}</dd></div><div><dt>签名</dt><dd>{selected.closureApproval.signature ?? '待签名'}</dd></div></dl>{selected.closureApproval.opinion && <p>{selected.closureApproval.opinion}</p>}{selected.closureApproval.status === '待审批' && <Space><Button icon={<BellFilled />} onClick={() => { remindEmergencyClosureApproval(selected.id); message.success('催办已记录并通知审批人'); }}>催办</Button><Button type="primary" onClick={() => handleAction('审批关闭')}>审批关闭</Button></Space>}</> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={selected.status === '监控中' ? '申请关闭后将生成审批任务' : '暂无关闭审批任务'} />}</div>
        </section>
        <section className={styles.operations}><h3>操作留痕 <span>{selected.operations.length} 条</span></h3>{[...selected.operations].reverse().map((operation) => <article key={operation.id}>
          <i /><div><header><strong>{operation.action}</strong><time>{operation.operatedAt}</time></header><p>{operation.detail}</p><footer><span>{operation.operator}</span><em>{operation.fromStatus ? `${operation.fromStatus} → ` : ''}{operation.toStatus}</em><b>{operation.fromLevel && operation.fromLevel !== operation.toLevel ? `${operation.fromLevel} → ` : ''}{operation.toLevel}</b></footer></div>
        </article>)}</section>
      </section>}
    </main>
    <Modal title={`归档事件证据 · ${selected?.code ?? ''}`} open={evidenceOpen} onCancel={() => setEvidenceOpen(false)} onOk={() => evidenceForm.validateFields().then((values) => { if (!selected) return; addEmergencyEventEvidence(selected.id, values); setEvidenceOpen(false); evidenceForm.resetFields(); message.success('事件证据已归档'); })} okText="归档证据"><Form form={evidenceForm} layout="vertical"><Form.Item name="name" label="证据名称" rules={[{ required: true }]}><Input /></Form.Item><div className={styles.formGrid}><Form.Item name="category" label="证据类别" rules={[{ required: true }]}><Select options={['现场照片', '监测报告', '处置记录', '审批材料'].map((value) => ({ value }))} /></Form.Item><Form.Item name="uploader" label="归档人" rules={[{ required: true }]}><Input /></Form.Item></div><Form.Item name="note" label="证据说明" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item><p className={styles.formHint}>当前原型记录附件元数据和本地指纹，实际文件与哈希待对接对象存储服务。</p></Form></Modal>
    <Modal title={`审批关闭 · ${selected?.code ?? ''}`} open={approvalOpen} onCancel={() => setApprovalOpen(false)} onOk={() => approvalForm.validateFields().then(({ opinion }) => { if (!selected) return; approveEmergencyEventClosure(selected.id, opinion); setApprovalOpen(false); message.success('关闭审批已签署，事件已归档'); })} okText="签署并关闭"><Form form={approvalForm} layout="vertical"><Form.Item name="opinion" label="审批意见" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item><p className={styles.formHint}>签署人：{selected?.closureApproval?.assignee ?? '赵磊 / QHSE 管理部'}</p></Form></Modal>
  </PageContainer>;
}
