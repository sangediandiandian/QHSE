import type { AlarmEvent, DashboardData, RiskLevel, WarningEvidenceCategory } from '@/types/qhse';
import {
  buildWarningEvidence,
  getWarningEvidenceCount,
  type WarningEvidenceReading,
} from '@/utils/warningEvidenceWorkflow';
import {
  AlertFilled,
  ApiOutlined,
  AuditOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentFilled,
  ExperimentFilled,
  FileProtectOutlined,
  NotificationFilled,
  PhoneFilled,
  PlayCircleFilled,
  SafetyCertificateFilled,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useAccess, useModel, useParams } from '@umijs/max';
import { Button, Empty, Input, Modal, Progress, Skeleton, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import styles from './index.less';

const levelText: Record<RiskLevel, string> = { low: '低风险', medium: '一般预警', high: '较大预警', critical: '重大预警' };
const categories: WarningEvidenceCategory[] = ['监测数据', '工艺参数', '作业票证', '关联人员'];

function Sparkline({ reading }: { reading: WarningEvidenceReading }) {
  const max = Math.max(...reading.trend, 1);
  const min = Math.min(...reading.trend, 0);
  const range = Math.max(1, max - min);
  const points = reading.trend.map((value, index) => `${(index / Math.max(1, reading.trend.length - 1)) * 100},${32 - ((value - min) / range) * 27}`).join(' ');
  return <svg className={styles.sparkline} viewBox="0 0 100 34" preserveAspectRatio="none" aria-label={`${reading.code} 趋势`}><polyline points={points} /></svg>;
}

function EvidenceFooter({ category, checked, disabled, onVerify }: { category: WarningEvidenceCategory; checked: boolean; disabled: boolean; onVerify: (category: WarningEvidenceCategory) => void }) {
  return <footer><span>{checked ? <><CheckCircleFilled /> 已完成一致性核验</> : disabled ? '暂无可核验数据' : '等待值班人员核验'}</span><Button size="small" disabled={checked || disabled} onClick={() => onVerify(category)}>{checked ? '已核验' : `核验${category}`}</Button></footer>;
}

function EvidencePanel({ dashboard, event, onVerify }: { dashboard: DashboardData; event: AlarmEvent; onVerify: (category: WarningEvidenceCategory) => void }) {
  const bundle = buildWarningEvidence(dashboard, event);
  const available = getWarningEvidenceCount(bundle);
  const checked = new Set(event.evidenceChecks?.map((item) => item.category) ?? []);
  const verified = categories.filter((item) => checked.has(item)).length;
  const checkTime = (category: WarningEvidenceCategory) => event.evidenceChecks?.find((item) => item.category === category)?.checkedAt;

  return (
    <section className={styles.evidenceSection}>
      <header className={styles.evidenceHead}>
        <div><span>LINKED EVIDENCE CHAIN</span><h2>事件关联证据</h2><p>按事件区域和来源实时聚合，核验操作写入处置时间线。</p></div>
        <div><strong>{available}<em>/4</em></strong><span>证据类别已关联</span><Progress percent={verified * 25} showInfo={false} strokeColor="#21836d" /><small>{verified} / 4 类已核验</small></div>
      </header>
      <div className={styles.evidenceGrid}>
        <article className={styles.evidenceCard}>
          <header><ApiOutlined /><strong>监测数据与趋势</strong><Tag color={checked.has('监测数据') ? 'success' : 'warning'}>{checked.has('监测数据') ? '已核验' : `${bundle.readings.length} 个测点`}</Tag></header>
          <div className={styles.readingList}>{bundle.readings.slice(0, 4).map((reading) => <div key={reading.id}><span><code>{reading.code}</code><strong>{reading.value}</strong><small>{reading.name} · {reading.status}</small></span><Sparkline reading={reading} /></div>)}</div>
          {checkTime('监测数据') && <small className={styles.checkTime}>核验时间 {checkTime('监测数据')}</small>}
          <EvidenceFooter category="监测数据" checked={checked.has('监测数据')} disabled={!bundle.readings.length} onVerify={onVerify} />
        </article>

        <article className={styles.evidenceCard}>
          <header><ExperimentFilled /><strong>工艺参数关联</strong><Tag color={checked.has('工艺参数') ? 'success' : 'processing'}>{checked.has('工艺参数') ? '已核验' : `${bundle.processes.length} 项参数`}</Tag></header>
          <div className={styles.processList}>{bundle.processes.slice(0, 5).map((item) => <div key={item.id}><code>{item.code}</code><span><strong>{item.name}</strong><small>{item.status}</small></span><em>{item.value}</em></div>)}</div>
          {checkTime('工艺参数') && <small className={styles.checkTime}>核验时间 {checkTime('工艺参数')}</small>}
          <EvidenceFooter category="工艺参数" checked={checked.has('工艺参数')} disabled={!bundle.processes.length} onVerify={onVerify} />
        </article>

        <article className={styles.evidenceCard}>
          <header><FileProtectOutlined /><strong>同区域作业票证</strong><Tag color={checked.has('作业票证') ? 'success' : bundle.permits.length ? 'error' : 'default'}>{checked.has('作业票证') ? '已核验' : `${bundle.permits.length} 张在办`}</Tag></header>
          <div className={styles.permitList}>{bundle.permits.map((permit) => <div key={permit.id}><span><code>{permit.code}</code><strong>{permit.type} · {permit.status}</strong><small>{permit.workContent}</small></span><Tag color={permit.riskLevel === '重大' ? 'error' : 'warning'}>{permit.riskLevel}</Tag></div>)}</div>
          {checkTime('作业票证') && <small className={styles.checkTime}>核验时间 {checkTime('作业票证')}</small>}
          <EvidenceFooter category="作业票证" checked={checked.has('作业票证')} disabled={!bundle.permits.length} onVerify={onVerify} />
        </article>

        <article className={styles.evidenceCard}>
          <header><UserOutlined /><strong>关联人员与送达</strong><Tag color={checked.has('关联人员') ? 'success' : 'processing'}>{checked.has('关联人员') ? '已核验' : `${bundle.people.length} 人`}</Tag></header>
          <div className={styles.peopleList}>{bundle.people.map((person) => <div key={person.id}><i>{person.name.slice(0, 1)}</i><span><strong>{person.name}</strong><small>{person.role}</small></span><em>{person.status}</em></div>)}</div>
          {checkTime('关联人员') && <small className={styles.checkTime}>核验时间 {checkTime('关联人员')}</small>}
          <EvidenceFooter category="关联人员" checked={checked.has('关联人员')} disabled={!bundle.people.length} onVerify={onVerify} />
        </article>
      </div>
    </section>
  );
}

export default function WarningDetail() {
  const { id } = useParams<{ id: string }>();
  const access = useAccess();
  const { dashboard, loading, loadDashboard, confirmAlarm, startEmergency, closeAlarm, verifyAlarmEvidence, warningRuleApiMode } = useModel('qhse');
  const [mutating, setMutating] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  const event = dashboard?.alarms.find((item) => item.id === id);
  if (!event || !dashboard) return <PageContainer><Empty description="事件不存在或模拟场景已重置"><Button onClick={() => history.push('/warnings')}>返回预警中心</Button></Empty></PageContainer>;

  const confirmed = event.status !== '待确认';
  const processing = event.status === '处置中';
  const planName = event.source === 'VOC' ? 'VOC 治理设施异常核查方案' : '可燃气体泄漏现场处置方案';
  const responseTasks = event.source === 'VOC'
    ? [
      ['核查 RTO 风机与阀门', '环保管理部 · 周敏'],
      ['复测出口非甲烷总烃', '环境监测组 · 刘洋'],
      ['核对装置生产负荷', '生产调度 · 陈涛'],
      ['评估降负荷运行措施', '装置运行部 · 李强'],
    ]
    : [
      ['现场确认泄漏点', '运行一部 · 李强'],
      ['停止附近动火作业', '安全管理部 · 王磊'],
      ['人员撤离与清点', '属地班组 · 赵敏'],
      ['调整生产负荷', '生产调度 · 陈涛'],
    ];
  const communications = dashboard.communicationTasks.filter((task) => task.eventId === event.id);
  const owner = communications[0]?.receiver ?? '张伟';

  const handleConfirm = async () => {
    setMutating(true);
    try {
      await confirmAlarm(event.id);
      message.success('事件已确认，确认记录已写入时间线');
    } finally {
      setMutating(false);
    }
  };
  const handleStart = async () => {
    setMutating(true);
    try {
      await startEmergency(event.id);
      message.success(warningRuleApiMode ? '预警处置已启动' : '应急预案已启动，处置任务已生成');
    } finally {
      setMutating(false);
    }
  };
  const handleClose = async () => {
    setMutating(true);
    try {
      await closeAlarm(event.id, closeReason.trim());
      setCloseOpen(false);
      message.success('预警已关闭并写入审计记录');
      history.push('/warnings');
    } finally {
      setMutating(false);
    }
  };
  const handleVerify = (category: WarningEvidenceCategory) => {
    verifyAlarmEvidence(event.id, category);
    message.success(`${category}已核验并写入时间线`);
  };

  return (
    <PageContainer
      title={false}
      className={styles.page}
      extra={[
        <Button key="confirm" loading={mutating} disabled={confirmed || !access.canHandleWarning} icon={<CheckCircleFilled />} onClick={() => void handleConfirm()}>{confirmed ? '已确认' : '确认事件'}</Button>,
        <Button key="start" type="primary" danger loading={mutating} disabled={!confirmed || processing || !access.canHandleWarning} icon={<PlayCircleFilled />} onClick={() => void handleStart()}>{processing ? (warningRuleApiMode ? '处置中' : '预案已启动') : (warningRuleApiMode ? '开始处置' : '启动应急预案')}</Button>,
        warningRuleApiMode && <Button key="close" disabled={!confirmed || !access.canCloseWarning} onClick={() => setCloseOpen(true)}>关闭预警</Button>,
      ]}
    >
      <section className={`${styles.eventHero} ${styles[event.level]}`}>
        <div className={styles.eventLevel}><AlertFilled /><span>{levelText[event.level]}</span></div>
        <div className={styles.eventTitle}><span>{event.code} · {event.source}</span><h1>{event.title}</h1><p><EnvironmentFilled /> {event.areaName}<i />发生于 {event.occurredAt}<i />责任人：{owner}</p></div>
        <div className={styles.eventState}><span>当前状态</span><strong>{event.status}</strong><small><ClockCircleOutlined /> 操作记录 {event.operations?.length ?? 0} 条</small></div>
      </section>

      <EvidencePanel dashboard={dashboard} event={event} onVerify={handleVerify} />

      <section className={styles.workspace}>
        <article className={styles.timelinePanel}>
          <header><div><span>EVENT CHRONOLOGY</span><h2>事件处置时间线</h2></div><Tag color={processing ? 'processing' : 'warning'}>{event.status}</Tag></header>
          <div className={styles.timeline}>
            <div className={styles.done}><i /><time>{event.occurredAt}</time><div><strong>监测异常进入系统</strong><p>{event.source} 数据校验通过，设备、区域和规则映射完成。</p></div></div>
            {(event.operations ?? []).map((operation) => <div key={operation.id} className={['预案启动', '处置启动'].includes(operation.type) ? styles.active : styles.done}><i /><time>{operation.operatedAt.split(' ')[1] ?? operation.operatedAt}</time><div><strong>{operation.type} · {operation.operator}</strong><p>{operation.detail}</p></div></div>)}
            {!confirmed && <div className={styles.active}><i /><time>等待中</time><div><strong>责任人确认事件</strong><p>等待责任人确认，超时后将自动升级通知。</p></div></div>}
            {confirmed && !processing && <div className={styles.pending}><i /><time>未开始</time><div><strong>启动预案并执行任务</strong><p>事件已确认，可启动《{planName}》。</p></div></div>}
            <div className={styles.pending}><i /><time>未开始</time><div><strong>解除风险并关闭事件</strong><p>所有关键任务完成且监测值恢复正常后可申请关闭。</p></div></div>
          </div>
        </article>

        <aside className={styles.sideColumn}>
          <article className={styles.planCard}>
            <header><SafetyCertificateFilled /><span>推荐应急预案</span></header><strong>{planName}</strong><p>匹配介质、装置区域和报警等级，推荐度 96%。</p><Progress percent={96} showInfo={false} strokeColor="#1a7791" /><Button block disabled={!confirmed || processing || !access.canHandleWarning} onClick={() => void handleStart()}>{processing ? '执行中' : warningRuleApiMode ? '开始处置' : '启动该预案'}</Button>
          </article>
          <article className={styles.communication}>
            <header><NotificationFilled /><span>融合通信</span><Tag bordered={false}>{communications.length ? `${communications.length} 人` : '待启动'}</Tag></header>
            {communications.length ? communications.map((task) => <div key={task.id}><PhoneFilled /><span>{task.receiver} · {task.receiverRole}</span><strong>{task.confirmStatus}</strong></div>) : <div><TeamOutlined /><span>暂无关联通知</span><strong>待发送</strong></div>}
          </article>
          <article className={styles.auditCard}><AuditOutlined /><span>证据核验审计<strong>{event.evidenceChecks?.length ?? 0} / 4 类已核验</strong><small>核验、确认和预案启动均保留操作人及时间。</small></span></article>
        </aside>
      </section>

      <section className={styles.tasks}>
        <header><div><span>RESPONSE TASKS</span><h2>应急处置任务</h2></div><span>{processing ? '1 / 4 已完成' : '启动预案后自动生成'}</span></header>
        {responseTasks.map(([task, taskOwner], index) => (
          <div key={task}><span className={processing && index === 0 ? styles.taskDone : styles.taskIndex}>{processing && index === 0 ? <CheckCircleFilled /> : String(index + 1).padStart(2, '0')}</span><strong>{task}</strong><span>{taskOwner}</span><time>{processing ? ['已完成', '剩余 04:12', '剩余 06:30', '剩余 08:00'][index] : '待生成'}</time></div>
        ))}
      </section>
      <Modal title="关闭预警" open={closeOpen} confirmLoading={mutating} okButtonProps={{ disabled: !closeReason.trim() }} okText="确认关闭" cancelText="取消" onOk={() => void handleClose()} onCancel={() => { if (!mutating) setCloseOpen(false); }}>
        <p>请确认现场风险已解除，并填写可审计的关闭原因。</p>
        <Input.TextArea value={closeReason} maxLength={500} showCount rows={4} placeholder="填写监测恢复情况和处置结论" onChange={(input) => setCloseReason(input.target.value)} />
      </Modal>
    </PageContainer>
  );
}
