import type { AlarmEvent, PlantArea, RiskLevel, TrendPoint } from '@/types/qhse';
import {
  AlertFilled,
  ApiFilled,
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  CloudFilled,
  CompressOutlined,
  EnvironmentFilled,
  ExperimentFilled,
  FireFilled,
  FullscreenOutlined,
  PhoneFilled,
  ReloadOutlined,
  SafetyCertificateFilled,
  ThunderboltFilled,
} from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import { Button, Empty, Skeleton, Tooltip } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const riskText: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '一般风险',
  high: '较大风险',
  critical: '重大风险',
};

const alarmLevelText: Record<RiskLevel, string> = {
  low: '提示',
  medium: '一般',
  high: '较大',
  critical: '重大',
};

function ScreenPanel({
  title,
  code,
  extra,
  children,
  className = '',
}: {
  title: string;
  code: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <header className={styles.panelHeader}>
        <div>
          <span>{code}</span>
          <h2>{title}</h2>
        </div>
        {extra}
      </header>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(80, ...data.flatMap((item) => [item.gds, item.voc, item.mes]));
  const points = (key: 'gds' | 'voc' | 'mes') =>
    data
      .map((item, index) => {
        const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 100;
        return `${x},${72 - (item[key] / max) * 58}`;
      })
      .join(' ');

  return (
    <div className={styles.trendChart}>
      <svg viewBox="0 0 100 78" preserveAspectRatio="none" role="img" aria-label="多源监测趋势">
        <defs>
          <linearGradient id="screenTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#27d8ff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#27d8ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[14, 33, 52, 71].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} className={styles.gridLine} />)}
        <polygon points={`0,72 ${points('gds')} 100,72`} fill="url(#screenTrendFill)" />
        <polyline points={points('gds')} className={styles.gdsLine} />
        <polyline points={points('voc')} className={styles.vocLine} />
        <polyline points={points('mes')} className={styles.mesLine} />
      </svg>
      <div className={styles.trendLabels}>{data.map((item) => <span key={item.label}>{item.label}</span>)}</div>
      <div className={styles.legend}>
        <span className={styles.cyan}>GDS</span>
        <span className={styles.orange}>VOC</span>
        <span className={styles.purple}>MES</span>
      </div>
    </div>
  );
}

function PlantMap({ areas, alarms }: { areas: PlantArea[]; alarms: AlarmEvent[] }) {
  return (
    <div className={styles.plantMap}>
      <div className={styles.mapGrid} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className={styles.pipes}>
        <path d="M18 42 V49 H49 V56 M50 41 V49 H80 V55 M29 70 H37 M61 70 H70" />
        <path d="M30 26 H38 M62 25 H70" className={styles.secondaryPipe} />
      </svg>
      <div className={styles.north}><i />N</div>
      {areas.map((area) => {
        const areaAlarms = alarms.filter((alarm) => alarm.areaId === area.id);
        return (
          <button
            type="button"
            key={area.id}
            className={`${styles.mapArea} ${styles[area.riskLevel]} ${area.status === 'alarm' ? styles.alarming : ''}`}
            style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.width}%`, height: `${area.height}%` }}
            onClick={() => history.push('/dashboard')}
            aria-label={`${area.name}，${riskText[area.riskLevel]}`}
          >
            <span>{area.code}</span>
            <strong>{area.shortName}</strong>
            <small><i />{area.status === 'normal' ? '运行平稳' : area.status === 'warning' ? '重点监控' : `${areaAlarms.length} 项告警`}</small>
            {area.status === 'alarm' && <EnvironmentFilled />}
          </button>
        );
      })}
      <div className={styles.mapLegend}>
        {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((level) => <span key={level}><i className={styles[level]} />{riskText[level]}</span>)}
      </div>
    </div>
  );
}

export default function BigScreen() {
  const { dashboard, loading, loadDashboard } = useModel('qhse');
  const [now, setNow] = useState(new Date());
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }, []);

  const statistics = useMemo(() => {
    if (!dashboard) return undefined;
    const gdsAlarmCount = dashboard.gdsPoints.filter((point) => point.alarmStatus !== 'normal').length;
    const vocAbnormalCount = dashboard.vocPoints.filter((point) => point.status !== 'normal').length;
    const mesAbnormalCount = dashboard.mesTags.filter((tag) => tag.status !== 'normal').length;
    const taskCompleted = dashboard.emergencyTasks.filter((task) => task.status === '已完成').length;
    const communicationConfirmed = dashboard.communicationTasks.filter((task) => task.confirmStatus === '已确认').length;
    const resourceReady = dashboard.emergencyResources.filter((resource) => resource.status === '已到位').length;
    return { gdsAlarmCount, vocAbnormalCount, mesAbnormalCount, taskCompleted, communicationConfirmed, resourceReady };
  }, [dashboard]);

  if (!dashboard && loading) return <div className={styles.state}><Skeleton active paragraph={{ rows: 16 }} /></div>;
  if (!dashboard || !statistics) return <div className={styles.state}><Empty description="大屏数据暂不可用"><Button onClick={() => void loadDashboard()}>重新加载</Button></Empty></div>;

  const dateText = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).format(now);
  const timeText = now.toLocaleTimeString('zh-CN', { hour12: false });
  const communicationRate = dashboard.communicationTasks.length
    ? Math.round((statistics.communicationConfirmed / dashboard.communicationTasks.length) * 100)
    : 0;
  const taskRate = dashboard.emergencyTasks.length
    ? Math.round((statistics.taskCompleted / dashboard.emergencyTasks.length) * 100)
    : 0;

  return (
    <main className={styles.screen}>
      <div className={styles.ambient} />
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <SafetyCertificateFilled />
          <span><strong>QHSE</strong><small>REFINERY SAFETY OPERATIONS</small></span>
        </div>
        <div className={styles.title}>
          <i />
          <div><h1>炼化企业 QHSE 风险联动展示大屏</h1><span>多源感知 · 风险研判 · 应急协同 · 闭环处置</span></div>
          <i />
        </div>
        <div className={styles.systemStatus}>
          <span><i />系统运行正常</span>
          <Tooltip title="返回管理端"><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => history.push('/dashboard')} /></Tooltip>
          <Tooltip title="刷新数据"><Button type="text" icon={<ReloadOutlined />} onClick={() => void loadDashboard()} /></Tooltip>
          <Tooltip title={fullscreen ? '退出全屏' : '进入全屏'}><Button type="text" icon={fullscreen ? <CompressOutlined /> : <FullscreenOutlined />} onClick={() => void toggleFullscreen()} /></Tooltip>
        </div>
      </header>

      <section className={styles.kpiRow}>
        <article><span><SafetyCertificateFilled />企业综合风险</span><strong className={styles.riskValue}>{dashboard.metrics.overallRisk}</strong><small>风险态势总体可控</small></article>
        <article><span><ApiFilled />GDS 在线率</span><strong>{dashboard.metrics.gdsOnlineRate}<em>%</em></strong><small>{dashboard.gdsPoints.filter((item) => item.onlineStatus === 'online').length} / {dashboard.gdsPoints.length} 测点在线</small></article>
        <article><span><FireFilled />活动告警</span><strong className={styles.alertValue}>{dashboard.metrics.activeAlarms}<em>项</em></strong><small>{dashboard.alarms.filter((item) => item.status === '待确认').length} 项等待确认</small></article>
        <article><span><CloudFilled />VOC 达标率</span><strong>{dashboard.metrics.vocComplianceRate}<em>%</em></strong><small>{statistics.vocAbnormalCount} 个点位异常</small></article>
        <article><span><ExperimentFilled />MES 异常参数</span><strong>{dashboard.metrics.mesAnomalies}<em>项</em></strong><small>{statistics.mesAbnormalCount} 个参数需关注</small></article>
        <article><span><PhoneFilled />通信送达率</span><strong>{dashboard.metrics.deliveryRate}<em>%</em></strong><small>{communicationRate}% 已确认</small></article>
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.leftColumn}>
          <ScreenPanel title="多源数据监测" code="MULTI-SOURCE MONITORING">
            <div className={styles.sourceCards}>
              <div><i className={styles.gdsSource}><FireFilled /></i><span><strong>GDS</strong><small>气体探测</small></span><em>{statistics.gdsAlarmCount}<small> 异常</small></em></div>
              <div><i className={styles.vocSource}><CloudFilled /></i><span><strong>VOC</strong><small>排放监测</small></span><em>{statistics.vocAbnormalCount}<small> 异常</small></em></div>
              <div><i className={styles.mesSource}><ExperimentFilled /></i><span><strong>MES</strong><small>工艺参数</small></span><em>{statistics.mesAbnormalCount}<small> 异常</small></em></div>
            </div>
          </ScreenPanel>
          <ScreenPanel title="近一小时关联趋势" code="CORRELATION TREND" className={styles.trendPanel}>
            <TrendChart data={dashboard.trend} />
          </ScreenPanel>
          <ScreenPanel title="重点装置风险" code="UNIT RISK RANKING" className={styles.rankingPanel}>
            <div className={styles.ranking}>
              {[...dashboard.areas].sort((a, b) => ['low', 'medium', 'high', 'critical'].indexOf(b.riskLevel) - ['low', 'medium', 'high', 'critical'].indexOf(a.riskLevel)).slice(0, 4).map((area, index) => (
                <div key={area.id}><b>0{index + 1}</b><span><strong>{area.name}</strong><small>{area.code} · {area.status === 'alarm' ? '存在活动告警' : area.status === 'warning' ? '重点监控' : '运行平稳'}</small></span><em className={styles[area.riskLevel]}>{riskText[area.riskLevel]}</em></div>
              ))}
            </div>
          </ScreenPanel>
        </div>

        <div className={styles.centerColumn}>
          <ScreenPanel title="厂区装置风险态势" code="PLANT RISK SITUATION" extra={<span className={styles.live}><i />实时监测</span>} className={styles.mapPanel}>
            <PlantMap areas={dashboard.areas} alarms={dashboard.alarms} />
          </ScreenPanel>
          <div className={styles.centerBottom}>
            <ScreenPanel title="应急处置进度" code="EMERGENCY RESPONSE">
              <div className={styles.responseStatus}>
                <div className={styles.progressRing} style={{ '--progress': `${taskRate * 3.6}deg` } as React.CSSProperties}><span><strong>{taskRate}%</strong><small>任务完成</small></span></div>
                <div className={styles.responseDetails}>
                  <strong>{dashboard.emergencyPlan.responseLevel}响应 · {dashboard.emergencyPlan.name}</strong>
                  <span><i />现场指挥：{dashboard.emergencyPlan.commander}</span>
                  <span><i />集合点：{dashboard.emergencyPlan.assemblyPoint}</span>
                  <small>{statistics.taskCompleted} / {dashboard.emergencyTasks.length} 项任务完成</small>
                </div>
              </div>
            </ScreenPanel>
            <ScreenPanel title="资源与通信" code="RESOURCE & COMMUNICATION">
              <div className={styles.dispatchStats}>
                <div><ThunderboltFilled /><span><strong>{statistics.resourceReady}</strong><small>资源已到位</small></span></div>
                <div><PhoneFilled /><span><strong>{statistics.communicationConfirmed}</strong><small>人员已确认</small></span></div>
                <div><CheckCircleFilled /><span><strong>{dashboard.emergencyTasks.filter((item) => item.status === '执行中').length}</strong><small>任务执行中</small></span></div>
              </div>
            </ScreenPanel>
          </div>
        </div>

        <div className={styles.rightColumn}>
          <ScreenPanel title="实时预警事件" code="LIVE WARNING EVENTS" extra={<span className={styles.alarmCount}>{dashboard.alarms.length}</span>} className={styles.alarmPanel}>
            <div className={styles.alarmList}>
              {dashboard.alarms.slice(0, 5).map((alarm) => (
                <button type="button" key={alarm.id} onClick={() => history.push(`/warnings/${alarm.id}`)}>
                  <i className={styles[alarm.level]} />
                  <span><small>{alarm.code} · {alarm.source}</small><strong>{alarm.title}</strong><em>{alarm.areaName} · {alarm.value}</em></span>
                  <time>{alarm.occurredAt}<b>{alarmLevelText[alarm.level]}</b></time>
                </button>
              ))}
            </div>
          </ScreenPanel>
          <ScreenPanel title="处置闭环态势" code="CLOSED-LOOP STATUS" className={styles.loopPanel}>
            <div className={styles.loopFlow}>
              {[
                ['监测接入', dashboard.gdsPoints.length + dashboard.vocPoints.length + dashboard.mesTags.length, <ApiFilled />],
                ['智能研判', dashboard.alarms.length, <SafetyCertificateFilled />],
                ['通信通知', dashboard.communicationTasks.length, <PhoneFilled />],
                ['任务处置', dashboard.emergencyTasks.length, <ThunderboltFilled />],
                ['关闭复盘', dashboard.eventReviews.length, <CheckCircleFilled />],
              ].map(([label, value, icon], index) => <div key={String(label)}><i>{icon}</i><span><strong>{value}</strong><small>{label}</small></span>{index < 4 && <b>›</b>}</div>)}
            </div>
          </ScreenPanel>
          <ScreenPanel title="运行保障" code="OPERATION ASSURANCE" className={styles.assurancePanel}>
            <div className={styles.assurance}>
              <div><span><i className={styles.good} />接口健康度</span><strong>99.8%</strong></div>
              <div><span><i className={styles.good} />数据更新状态</span><strong>实时</strong></div>
              <div><span><i className={styles.warn} />高风险作业</span><strong>{dashboard.metrics.highRiskPermits} 项</strong></div>
              <div><span><i className={styles.good} />应急资源可用</span><strong>{dashboard.emergencyResources.length - dashboard.emergencyResources.filter((item) => item.inspectionStatus === '需要维护').length} / {dashboard.emergencyResources.length}</strong></div>
            </div>
          </ScreenPanel>
        </div>
      </div>

      <footer className={styles.footer}>
        <span><ClockCircleFilled />数据更新时间 {dashboard.updatedAt}</span>
        <div><i />GDS 数据正常<i />VOC 数据正常<i />MES 数据正常<i />通信链路正常</div>
        <time><small>{dateText}</small>{timeText}</time>
      </footer>
    </main>
  );
}
