import FactoryMap from '@/components/FactoryMap';
import type { EmergencyResource, EmergencyTaskStatus } from '@/types/qhse';
import {
  AlertFilled,
  CheckCircleFilled,
  ClockCircleFilled,
  CompassOutlined,
  EnvironmentFilled,
  FireFilled,
  MedicineBoxFilled,
  SafetyCertificateFilled,
  TeamOutlined,
  ThunderboltFilled,
  ToolFilled,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Empty, Progress, Skeleton, Tag, message } from 'antd';
import React, { useEffect, useMemo } from 'react';
import styles from './index.less';

const statusColor: Record<EmergencyTaskStatus, string> = {
  待执行: 'default',
  执行中: 'processing',
  已完成: 'success',
};

const resourceIcon: Record<EmergencyResource['type'], React.ReactNode> = {
  消防: <FireFilled />,
  气防: <SafetyCertificateFilled />,
  医疗: <MedicineBoxFilled />,
  物资: <ToolFilled />,
};

export default function EmergencyCommand() {
  const { dashboard, loading, loadDashboard, advanceEmergencyTask } = useModel('qhse');

  useEffect(() => {
    if (!dashboard) void loadDashboard();
  }, [dashboard, loadDashboard]);

  const completed = useMemo(
    () => dashboard?.emergencyTasks.filter((task) => task.status === '已完成').length ?? 0,
    [dashboard],
  );

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="应急指挥数据暂不可用" /></PageContainer>;

  const event = dashboard.alarms.find((item) => item.id === dashboard.emergencyPlan.eventId) ?? dashboard.alarms[0];
  const progress = Math.round((completed / dashboard.emergencyTasks.length) * 100);
  const activeTasks = dashboard.emergencyTasks.filter((task) => task.status === '执行中').length;
  const arrivedResources = dashboard.emergencyResources.filter((item) => item.status === '已到位').length;

  return (
    <PageContainer title={false} className={styles.page} extra={<Button danger icon={<ThunderboltFilled />}>升级应急响应</Button>}>
      <header className={styles.commandHeader}>
        <div className={styles.eventIdentity}>
          <span>EMERGENCY COMMAND / {event.code}</span>
          <h1>{event.title}</h1>
          <p><EnvironmentFilled /> {event.areaName} · {event.value} · 发生于 {event.occurredAt}</p>
        </div>
        <div className={styles.responseState}>
          <i />
          <div><span>当前响应</span><strong>{dashboard.emergencyPlan.responseLevel} · 处置中</strong><small>总指挥：{dashboard.emergencyPlan.commander}</small></div>
        </div>
      </header>

      <section className={styles.statusRail} aria-label="应急响应状态">
        <div><span>处置进度</span><strong>{progress}%</strong><Progress percent={progress} showInfo={false} strokeColor="#cf5b2a" /></div>
        <div><span>执行中任务</span><strong>{activeTasks}<em>项</em></strong><small>共 {dashboard.emergencyTasks.length} 项指令</small></div>
        <div><span>应急资源</span><strong>{arrivedResources}<em> / {dashboard.emergencyResources.length}</em></strong><small>已到位 / 已调度</small></div>
        <div><span>现场风况</span><strong>东南风 <em>3.2m/s</em></strong><small>影响范围向西北扩散</small></div>
        <div><span>人员清点</span><strong>26<em> / 32</em></strong><small>6 人正在撤离</small></div>
      </section>

      <main className={styles.commandGrid}>
        <section className={`${styles.panel} ${styles.mapPanel}`}>
          <header><div><span>INCIDENT MAP</span><h2>事件态势与疏散</h2></div><Tag color="error">100m 警戒区</Tag></header>
          <div className={styles.mapWrap}>
            <FactoryMap areas={dashboard.areas} selectedId={event.areaId} onSelect={() => undefined} />
            <div className={styles.wind}><CompassOutlined /><strong>SE</strong><span>3.2 m/s</span></div>
            <div className={styles.impactRing} aria-label="风险影响范围" />
          </div>
          <footer className={styles.mapFacts}>
            <div><EnvironmentFilled /><span>事件点位<strong>FCC 泵区东侧</strong></span></div>
            <div><TeamOutlined /><span>集合点<strong>{dashboard.emergencyPlan.assemblyPoint}</strong></span></div>
            <div><AlertFilled /><span>周边作业<strong>2 项已暂停</strong></span></div>
          </footer>
        </section>

        <section className={`${styles.panel} ${styles.taskPanel}`}>
          <header><div><span>ACTION BOARD</span><h2>现场处置任务</h2></div><strong className={styles.taskCount}>{completed}/{dashboard.emergencyTasks.length}</strong></header>
          <div className={styles.taskList}>
            {dashboard.emergencyTasks.map((task, index) => (
              <article key={task.id} className={styles.taskItem}>
                <b>{String(index + 1).padStart(2, '0')}</b>
                <div><div><strong>{task.name}</strong><Tag color={statusColor[task.status]}>{task.status}</Tag></div><p>{task.department} · {task.owner}</p><small><ClockCircleFilled /> 时限 {task.deadline}{task.feedback ? ` · ${task.feedback}` : ''}</small></div>
                <Button size="small" disabled={task.status === '已完成'} onClick={() => { advanceEmergencyTask(task.id); message.success(task.status === '待执行' ? '任务已开始执行' : '任务已完成'); }}>
                  {task.status === '待执行' ? '开始' : task.status === '执行中' ? '完成' : <CheckCircleFilled />}
                </Button>
              </article>
            ))}
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <section className={`${styles.panel} ${styles.planPanel}`}>
            <header><div><span>RECOMMENDED PLAN</span><h2>智能匹配预案</h2></div><em>{dashboard.emergencyPlan.matchScore}%</em></header>
            <Tag color="error">已启动 · {dashboard.emergencyPlan.responseLevel}</Tag>
            <h3>{dashboard.emergencyPlan.name}</h3>
            <code>{dashboard.emergencyPlan.code}</code>
            <p>{dashboard.emergencyPlan.matchReason}</p>
            <div className={styles.planSteps}><span>停止作业并撤离</span><span>切断物料与火源</span><span>警戒监测与堵漏</span></div>
          </section>

          <section className={`${styles.panel} ${styles.resourcePanel}`}>
            <header><div><span>RESOURCE DISPATCH</span><h2>应急资源</h2></div></header>
            <div className={styles.resourceList}>{dashboard.emergencyResources.map((resource) => (
              <div key={resource.id}>
                <i>{resourceIcon[resource.type]}</i>
                <span><strong>{resource.name}</strong><small>{resource.quantity} · {resource.location}</small></span>
                <em className={styles[resource.status]}>{resource.status}<small>{resource.eta}</small></em>
              </div>
            ))}</div>
          </section>
        </aside>
      </main>
    </PageContainer>
  );
}
