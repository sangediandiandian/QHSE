import type { CommunicationChannel, CommunicationTask } from '@/types/qhse';
import {
  AlertFilled,
  AppstoreFilled,
  CheckCircleFilled,
  ClockCircleFilled,
  MessageFilled,
  NotificationFilled,
  PhoneFilled,
  ReloadOutlined,
  SoundFilled,
  TeamOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Empty, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const channelIcon: Record<CommunicationChannel, React.ReactNode> = {
  App消息: <AppstoreFilled />, 电话语音: <PhoneFilled />, 短信: <MessageFilled />, IP广播: <SoundFilled />,
};

const stageMeta = [
  { minute: '0 min', title: '首次通知', description: 'App 消息送达岗位人员' },
  { minute: '2 min', title: '语音重呼', description: '责任人未确认，电话重呼' },
  { minute: '3 min', title: '班长升级', description: '通知当班班长介入' },
  { minute: '5 min', title: '指挥升级', description: '通知装置负责人和生产调度' },
];

function AuditRow({ task, onConfirm }: { task: CommunicationTask; onConfirm: () => void }) {
  return (
    <div className={styles.auditRow}>
      <span className={styles.channel}>{channelIcon[task.channel]}{task.channel}</span>
      <div><strong>{task.receiver}</strong><small>{task.receiverRole}</small></div>
      <time>{task.sendTime}</time>
      <span className={styles.delivered}>{task.deliveryStatus}</span>
      <span className={task.confirmStatus === '已确认' ? styles.confirmed : styles.unconfirmed}>{task.confirmStatus}</span>
      <span>{task.retryCount} 次</span>
      <Button size="small" disabled={task.confirmStatus === '已确认'} onClick={onConfirm}>{task.confirmStatus === '已确认' ? task.confirmTime : '模拟确认'}</Button>
    </div>
  );
}

export default function Communication() {
  const { dashboard, loading, loadDashboard, advanceCommunication, confirmCommunication } = useModel('qhse');
  const [eventId, setEventId] = useState('evt-001');
  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const eventTasks = useMemo(() => (dashboard?.communicationTasks ?? []).filter((task) => task.eventId === eventId), [dashboard, eventId]);
  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="通信数据暂不可用" /></PageContainer>;

  const events = dashboard.alarms.filter((event) => dashboard.communicationTasks.some((task) => task.eventId === event.id));
  const activeEvent = dashboard.alarms.find((event) => event.id === eventId) ?? events[0];
  const tasks = activeEvent ? dashboard.communicationTasks.filter((task) => task.eventId === activeEvent.id) : [];
  const currentStage = Math.max(0, ...tasks.map((task) => task.escalationLevel));
  const hasConfirmed = tasks.some((task) => task.confirmStatus === '已确认');
  const latestUnconfirmed = tasks.find((task) => task.confirmStatus !== '已确认');
  const delivered = dashboard.communicationTasks.filter((task) => task.deliveryStatus === '已送达').length;
  const confirmed = dashboard.communicationTasks.filter((task) => task.confirmStatus === '已确认').length;

  const escalate = () => {
    if (!activeEvent) return;
    advanceCommunication(activeEvent.id);
    message.warning(`已推进至 ${stageMeta[Math.min(currentStage + 1, 3)].title}`);
  };

  return (
    <PageContainer title={false} className={styles.page} extra={<Button danger disabled={currentStage >= 3 || hasConfirmed} icon={<ClockCircleFilled />} onClick={escalate}>模拟无人确认并推进时间</Button>}>
      <section className={styles.hero}>
        <div><span>FUSED COMMUNICATION CONSOLE</span><h1>融合通信控制台</h1><p>统一调度 App、电话、短信与广播，完整记录送达、确认和升级过程。</p></div>
        <div className={styles.metrics}>
          <div><NotificationFilled /><strong>{dashboard.communicationTasks.length}</strong><span>通信任务</span></div>
          <div><CheckCircleFilled /><strong>{delivered}</strong><span>已送达</span></div>
          <div><TeamOutlined /><strong>{confirmed}</strong><span>已确认</span></div>
          <div className={styles.metricDanger}><AlertFilled /><strong>{dashboard.communicationTasks.length - confirmed}</strong><span>待确认</span></div>
        </div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.eventQueue}>
          <header><span>ACTIVE EVENTS</span><h2>待通信事件</h2></header>
          {events.map((event) => {
            const eventTaskList = dashboard.communicationTasks.filter((task) => task.eventId === event.id);
            const eventConfirmed = eventTaskList.some((task) => task.confirmStatus === '已确认');
            return <button key={event.id} type="button" className={event.id === activeEvent?.id ? styles.selected : ''} onClick={() => setEventId(event.id)}><i className={styles[event.level]} /><div><strong>{event.title}</strong><span>{event.areaName} · {event.code}</span></div><Tag bordered={false}>{eventConfirmed ? '已响应' : '待响应'}</Tag></button>;
          })}
        </aside>

        <article className={styles.escalationPanel}>
          <header><div><span>ESCALATION CHAIN</span><h2>{activeEvent?.title ?? '选择事件'}</h2></div><Tag color={hasConfirmed ? 'success' : currentStage >= 3 ? 'error' : 'warning'}>{hasConfirmed ? '人员已确认' : `升级等级 L${currentStage}`}</Tag></header>
          <div className={styles.ladder}>
            {stageMeta.map((stage, index) => <div key={stage.minute} className={`${index < currentStage ? styles.completed : index === currentStage ? styles.active : styles.pending}`}><time>{stage.minute}</time><i>{index < currentStage ? <CheckCircleFilled /> : index + 1}</i><div><strong>{stage.title}</strong><span>{stage.description}</span></div>{index < 3 && <b />}</div>)}
          </div>
          <div className={styles.voiceTemplate}><PhoneFilled /><div><span>当前语音模板</span><p>紧急通知：{activeEvent?.areaName}发生{activeEvent?.title}，请立即确认并按现场处置方案执行。</p></div><Button size="small">试听模板</Button></div>
          <div className={styles.actions}><Button icon={<ReloadOutlined />} disabled={currentStage >= 3 || hasConfirmed} onClick={escalate}>推进下一升级节点</Button><Button type="primary" disabled={!latestUnconfirmed || hasConfirmed} onClick={() => latestUnconfirmed && confirmCommunication(latestUnconfirmed.id)}>模拟责任人确认</Button></div>
        </article>

        <aside className={styles.channels}>
          <header><span>CHANNEL HEALTH</span><h2>通信渠道</h2></header>
          {[
            ['App消息', <AppstoreFilled />, '在线', '98.6%'],
            ['电话语音', <PhoneFilled />, '在线', '96.2%'],
            ['短信', <MessageFilled />, '在线', '99.1%'],
            ['IP广播', <SoundFilled />, '在线', '100%'],
          ].map(([name, icon, state, rate]) => <div key={String(name)}>{icon}<span><strong>{name}</strong><small>{state}</small></span><em>{rate}</em></div>)}
        </aside>
      </section>

      <section className={styles.audit}>
        <header><div><span>COMMUNICATION AUDIT</span><h2>发送与确认记录</h2></div><small>{tasks.length} 条记录</small></header>
        <div className={styles.auditHead}><span>渠道</span><span>接收人</span><span>发送时间</span><span>送达</span><span>确认</span><span>重试</span><span>操作</span></div>
        {tasks.map((task) => <AuditRow key={task.id} task={task} onConfirm={() => confirmCommunication(task.id)} />)}
      </section>
    </PageContainer>
  );
}
