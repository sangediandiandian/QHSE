import type { VocFacility, VocPoint, VocPointStatus } from '@/types/qhse';
import {
  AlertFilled,
  CheckCircleFilled,
  CloudOutlined,
  DashboardOutlined,
  ExperimentFilled,
  FireFilled,
  ThunderboltFilled,
  ToolFilled,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Button, Empty, Progress, Skeleton, Tag, message } from 'antd';
import { useEffect } from 'react';
import styles from './index.less';

const statusText: Record<VocPointStatus, string> = {
  normal: '达标', warning: '接近限值', exceeded: '超限', offline: '离线',
};

function Trend({ values, limit, status }: { values: number[]; limit: number; status: VocPointStatus }) {
  const max = Math.max(limit * 1.25, ...values);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${42 - (value / max) * 36}`).join(' ');
  const limitY = 42 - (limit / max) * 36;
  return (
    <svg className={`${styles.trend} ${styles[status]}`} viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden>
      <line x1="0" y1={limitY} x2="100" y2={limitY} /><polyline points={points} />
    </svg>
  );
}

function PointCard({ point, onOpen }: { point: VocPoint; onOpen: () => void }) {
  const ratio = Math.round((point.currentValue / point.limitValue) * 100);
  return (
    <button type="button" className={`${styles.point} ${styles[point.status]}`} onClick={onOpen}>
      <header><span>{point.code}</span><Tag bordered={false}>{statusText[point.status]}</Tag></header>
      <div className={styles.pointReading}><strong>{point.status === 'offline' ? '--' : point.currentValue}<em>mg/m³</em></strong><span>限值 {point.limitValue}</span></div>
      <Trend values={point.trend} limit={point.limitValue} status={point.status} />
      <div className={styles.pointFoot}><strong>{point.name}</strong><span>{point.pointType} · {ratio}% 限值</span></div>
    </button>
  );
}

function FacilityCard({ facility }: { facility: VocFacility }) {
  return (
    <article className={`${styles.facility} ${styles[facility.status]}`}>
      <header><div><span>{facility.code}</span><h3>{facility.name}</h3></div><Tag bordered={false}>{facility.status === 'normal' ? '稳定运行' : facility.status === 'degraded' ? '效率下降' : '设施异常'}</Tag></header>
      <div className={styles.processFlow}>
        <div><span>入口浓度</span><strong>{facility.inletValue}<em>mg/m³</em></strong></div><i>→</i>
        <div className={styles.chamber}><FireFilled /><strong>{facility.processType}</strong><span>{facility.temperature}℃</span></div><i>→</i>
        <div><span>出口浓度</span><strong>{facility.outletValue}<em>mg/m³</em></strong></div>
      </div>
      <div className={styles.efficiency}><span>治理效率</span><strong>{facility.efficiency}%</strong><Progress percent={facility.efficiency} showInfo={false} strokeColor={facility.status === 'fault' ? '#c53030' : '#21836d'} /></div>
      <footer><span><ToolFilled /> 风机 {facility.fanStatus}</span><span><DashboardOutlined /> 阀门 {facility.valveStatus}</span><span><ExperimentFilled /> 装置负荷 86%</span></footer>
    </article>
  );
}

export default function VocMonitoring() {
  const { dashboard, loading, loadDashboard, simulateVocAlarm } = useModel('qhse');
  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="VOC 数据暂不可用" /></PageContainer>;

  const exceeded = dashboard.vocPoints.filter((point) => point.status === 'exceeded').length;
  const warning = dashboard.vocPoints.filter((point) => point.status === 'warning').length;
  const online = dashboard.vocPoints.filter((point) => point.status !== 'offline').length;
  const handleSimulation = () => {
    simulateVocAlarm();
    message.warning('RTO 一号排口已连续超限，环保预警与设施核查任务已生成');
  };
  const openPointEvent = (point: VocPoint) => {
    const event = dashboard.alarms.find((item) => item.source === 'VOC' && item.areaId === point.areaId);
    if (event) history.push(`/warnings/${event.id}`);
  };

  return (
    <PageContainer title={false} className={styles.page} extra={<Button danger icon={<ThunderboltFilled />} onClick={handleSimulation}>模拟 VOC 连续超限</Button>}>
      <section className={styles.hero}>
        <div><span>VOLATILE ORGANIC COMPOUNDS</span><h1>VOC 排放监测</h1><p>排口、厂界与治理设施统一监测，异常关联生产负荷进行研判。</p></div>
        <div className={styles.metrics}>
          <div><CloudOutlined /><strong>{online}/8</strong><span>在线监测点</span></div>
          <div><CheckCircleFilled /><strong>{dashboard.metrics.vocComplianceRate}<em>%</em></strong><span>当前达标率</span></div>
          <div className={styles.metricWarning}><AlertFilled /><strong>{warning}</strong><span>接近限值</span></div>
          <div className={styles.metricDanger}><ExperimentFilled /><strong>{exceeded}</strong><span>持续超限</span></div>
        </div>
      </section>

      <section className={styles.sectionHead}><div><span>TREATMENT TRAIN</span><h2>治理设施运行链路</h2></div><small>入口、炉膛、出口及生产负荷同步采集</small></section>
      <section className={styles.facilityGrid}>{dashboard.vocFacilities.map((facility) => <FacilityCard key={facility.id} facility={facility} />)}</section>

      <section className={styles.sectionHead}><div><span>EMISSION POINTS</span><h2>排口与厂界监测点</h2></div><small>虚线表示排放限值</small></section>
      <section className={styles.pointGrid}>{dashboard.vocPoints.map((point) => <PointCard key={point.id} point={point} onOpen={() => openPointEvent(point)} />)}</section>
    </PageContainer>
  );
}
