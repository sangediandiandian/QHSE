import type { AlarmEvent, RiskLevel } from '@/types/qhse';
import {
  AlertFilled,
  ApiOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentFilled,
  ExperimentFilled,
  NotificationFilled,
  PhoneFilled,
  PlayCircleFilled,
  SafetyCertificateFilled,
  TeamOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useModel, useParams } from '@umijs/max';
import { Button, Empty, Progress, Skeleton, Tag, message } from 'antd';
import { useEffect } from 'react';
import styles from './index.less';

const levelText: Record<RiskLevel, string> = { low: '低风险', medium: '一般预警', high: '较大预警', critical: '重大预警' };

function EvidencePanel({ event }: { event: AlarmEvent }) {
  const isGds = event.source === 'GDS' || event.source === '联合预警';
  return (
    <section className={styles.evidence}>
      <article><header><ApiOutlined /> 监测源</header><strong>{isGds ? 'GDS-101' : event.source}</strong><span>{event.areaName} · 泵区东侧</span></article>
      <article><header><AlertFilled /> 当前读数</header><strong className={styles.dangerValue}>{event.value}</strong><span>{isGds ? '二级阈值 40% LEL' : '已超过规则阈值'}</span></article>
      <article><header><ExperimentFilled /> MES 关联</header><strong>{isGds ? '出口压力 2.34 MPa' : '装置负荷 86%'}</strong><span>{isGds ? '较基线升高 12%' : '处于稳定运行区间'}</span></article>
      <article><header><EnvironmentFilled /> 空间关联</header><strong>附近 12 人</strong><span>1 张高风险作业票 · 2 路视频</span></article>
    </section>
  );
}

export default function WarningDetail() {
  const { id } = useParams<{ id: string }>();
  const { dashboard, loading, loadDashboard, confirmAlarm, startEmergency } = useModel('qhse');

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  const event = dashboard?.alarms.find((item) => item.id === id);
  if (!event) return <PageContainer><Empty description="事件不存在或模拟场景已重置"><Button onClick={() => history.push('/warnings')}>返回预警中心</Button></Empty></PageContainer>;

  const confirmed = event.status !== '待确认';
  const processing = event.status === '处置中';
  const isCritical = event.level === 'critical';
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

  const handleConfirm = () => {
    confirmAlarm(event.id);
    message.success('事件已确认，确认记录已写入时间线');
  };
  const handleStart = () => {
    startEmergency(event.id);
    message.success('应急预案已启动，处置任务已生成');
  };

  return (
    <PageContainer
      title={false}
      className={styles.page}
      extra={[
        <Button key="confirm" disabled={confirmed} icon={<CheckCircleFilled />} onClick={handleConfirm}>{confirmed ? '已确认' : '确认事件'}</Button>,
        <Button key="start" type="primary" danger disabled={!confirmed || processing} icon={<PlayCircleFilled />} onClick={handleStart}>{processing ? '预案已启动' : '启动应急预案'}</Button>,
      ]}
    >
      <section className={`${styles.eventHero} ${styles[event.level]}`}>
        <div className={styles.eventLevel}><AlertFilled /><span>{levelText[event.level]}</span></div>
        <div className={styles.eventTitle}><span>{event.code} · {event.source}</span><h1>{event.title}</h1><p><EnvironmentFilled /> {event.areaName}<i />发生于 {event.occurredAt}<i />责任人：张伟</p></div>
        <div className={styles.eventState}><span>当前状态</span><strong>{event.status}</strong><small><ClockCircleOutlined /> 已持续 06:18</small></div>
      </section>

      <EvidencePanel event={event} />

      <section className={styles.workspace}>
        <article className={styles.timelinePanel}>
          <header><div><span>EVENT CHRONOLOGY</span><h2>事件处置时间线</h2></div><Tag color={processing ? 'processing' : 'warning'}>{event.status}</Tag></header>
          <div className={styles.timeline}>
            <div className={styles.done}><i /><time>{event.occurredAt}</time><div><strong>监测异常进入系统</strong><p>{event.source} 数据校验通过，设备与区域映射完成。</p></div></div>
            <div className={styles.done}><i /><time>+ 00:03</time><div><strong>综合预警事件生成</strong><p>规则引擎关联 MES 参数、附近人员和高风险作业。</p></div></div>
            <div className={confirmed ? styles.done : styles.active}><i /><time>{confirmed ? '+ 01:12' : '等待中'}</time><div><strong>责任人确认事件</strong><p>{confirmed ? '装置负责人张伟已确认收到预警。' : '等待责任人确认，超时后将自动升级通知。'}</p></div></div>
            <div className={processing ? styles.active : styles.pending}><i /><time>{processing ? '+ 02:04' : '未开始'}</time><div><strong>启动预案并执行任务</strong><p>{processing ? `已启动《${planName}》，4 项任务执行中。` : '确认事件后可启动推荐预案。'}</p></div></div>
            <div className={styles.pending}><i /><time>未开始</time><div><strong>解除风险并关闭事件</strong><p>所有关键任务完成且监测值恢复正常后可申请关闭。</p></div></div>
          </div>
        </article>

        <aside className={styles.sideColumn}>
          <article className={styles.planCard}>
            <header><SafetyCertificateFilled /><span>推荐应急预案</span></header><strong>{planName}</strong><p>匹配介质、装置区域和报警等级，推荐度 96%。</p><Progress percent={96} showInfo={false} strokeColor="#1a7791" /><Button block disabled={!confirmed || processing} onClick={handleStart}>{processing ? '执行中' : '启动该预案'}</Button>
          </article>
          <article className={styles.communication}>
            <header><NotificationFilled /><span>融合通信</span><Tag bordered={false}>{processing ? '发送中' : '待启动'}</Tag></header>
            <div><PhoneFilled /><span>装置负责人</span><strong>{confirmed ? '已确认' : '呼叫中'}</strong></div>
            <div><TeamOutlined /><span>岗位与班组</span><strong>{processing ? '6/8 送达' : '待发送'}</strong></div>
            <div><NotificationFilled /><span>生产调度</span><strong>{processing ? '已送达' : '待发送'}</strong></div>
          </article>
        </aside>
      </section>

      <section className={styles.tasks}>
        <header><div><span>RESPONSE TASKS</span><h2>应急处置任务</h2></div><span>{processing ? '1 / 4 已完成' : '启动预案后自动生成'}</span></header>
        {responseTasks.map(([task, owner], index) => (
          <div key={task}><span className={processing && index === 0 ? styles.taskDone : styles.taskIndex}>{processing && index === 0 ? <CheckCircleFilled /> : String(index + 1).padStart(2, '0')}</span><strong>{task}</strong><span>{owner}</span><time>{processing ? ['已完成', '剩余 04:12', '剩余 06:30', '剩余 08:00'][index] : '待生成'}</time></div>
        ))}
      </section>
    </PageContainer>
  );
}
