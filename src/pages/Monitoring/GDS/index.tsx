import type { GdsAlarmStatus, GdsPoint } from '@/types/qhse';
import { isWarningScenarioEnabled } from '@/utils/warningRules';
import {
  AlertFilled,
  ApiOutlined,
  CheckCircleFilled,
  DisconnectOutlined,
  ThunderboltFilled,
  ToolFilled,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useAccess, useModel } from '@umijs/max';
import { Button, Empty, Segmented, Select, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const alarmText: Record<GdsAlarmStatus, string> = {
  normal: '正常',
  level1: '一级报警',
  level2: '二级报警',
  trend: '上升趋势',
};

function Sparkline({ values, status }: { values: number[]; status: GdsAlarmStatus }) {
  const max = Math.max(...values, 50);
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 100},${34 - (value / max) * 30}`)
    .join(' ');
  return (
    <svg className={`${styles.sparkline} ${styles[status]}`} viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden>
      <line x1="0" y1="18" x2="100" y2="18" />
      <polyline points={points} />
    </svg>
  );
}

function DetectorCard({ point, onOpen }: { point: GdsPoint; onOpen: () => void }) {
  const unavailable = point.onlineStatus !== 'online';
  return (
    <button type="button" className={`${styles.detector} ${styles[point.alarmStatus]} ${unavailable ? styles.unavailable : ''}`} onClick={onOpen}>
      <div className={styles.detectorHead}>
        <span>{point.code}</span>
        <Tag bordered={false}>{unavailable ? (point.onlineStatus === 'fault' ? '故障' : '离线') : alarmText[point.alarmStatus]}</Tag>
      </div>
      <strong>{unavailable ? '--' : point.currentValue}<em>{point.unit}</em></strong>
      <Sparkline values={point.trend} status={point.alarmStatus} />
      <div className={styles.detectorMeta}><span>{point.name}</span><small>{point.gasType}</small></div>
    </button>
  );
}

export default function GdsMonitoring() {
  const access = useAccess();
  const { dashboard, gdsPoints, telemetryLoading, telemetryApiMode, telemetryRealtimeStatus, loadTelemetry, ingestTelemetrySample, simulateGdsAlarm } = useModel('qhse');
  const [areaId, setAreaId] = useState('all');
  const [state, setState] = useState('全部');

  useEffect(() => { void loadTelemetry(); }, [loadTelemetry]);

  const points = useMemo(() => {
    return gdsPoints.filter((point) => {
      const areaMatch = areaId === 'all' || point.areaId === areaId;
      const stateMatch = state === '全部' ||
        (state === '报警' && ['level1', 'level2'].includes(point.alarmStatus)) ||
        (state === '异常' && (point.onlineStatus !== 'online' || point.alarmStatus === 'trend'));
      return areaMatch && stateMatch;
    });
  }, [areaId, gdsPoints, state]);

  if (telemetryLoading && !gdsPoints.length) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!gdsPoints.length) return <PageContainer><Empty description="GDS 数据暂不可用" /></PageContainer>;

  const alarms = gdsPoints.filter((point) => ['level1', 'level2'].includes(point.alarmStatus)).length;
  const offline = gdsPoints.filter((point) => point.onlineStatus === 'offline').length;
  const faults = gdsPoints.filter((point) => point.onlineStatus === 'fault').length;
  const areas = Array.from(new Map(gdsPoints.map((point) => [point.areaId, point.areaName])).entries());
  const handleSimulation = async () => {
    if (telemetryApiMode) {
      await ingestTelemetrySample({ sampleId: `ui-gds-${Date.now()}`, pointId: 'gds-101', source: 'GDS', occurredAt: new Date().toISOString(), metrics: { gasConcentration: 55 }, quality: 'good' });
      message.warning('GDS-101 样本已写入服务端并执行预警规则');
      return;
    }
    if (!dashboard || !isWarningScenarioEnabled(dashboard, 'gds-level2')) {
      message.info('GDS 二级报警规则已停用，请先在预警规则页面启用');
      return;
    }
    simulateGdsAlarm();
    message.warning('GDS-101 已进入二级报警，关联事件已生成');
  };

  return (
    <PageContainer title={false} className={styles.page} extra={[telemetryApiMode && <Tag key="realtime" color={telemetryRealtimeStatus === 'connected' ? 'success' : 'warning'}>实时通道：{telemetryRealtimeStatus === 'connected' ? '已连接' : '重连中'}</Tag>, <Button key="simulate" danger disabled={telemetryApiMode && !access.canIngestTelemetry} icon={<ThunderboltFilled />} onClick={() => void handleSimulation()}>模拟 GDS 二级报警</Button>]}>
      <section className={styles.heading}>
        <div><span>GAS DETECTION SYSTEM</span><h1>GDS 气体监测</h1><p>{gdsPoints.length} 个固定式探测器正在监测可燃气体、有毒气体与氧含量。</p></div>
        <div className={styles.summary}>
          <div><ApiOutlined /><strong>{gdsPoints.length - offline - faults}</strong><span>在线测点</span></div>
          <div className={styles.warning}><AlertFilled /><strong>{alarms}</strong><span>活动报警</span></div>
          <div><DisconnectOutlined /><strong>{offline}</strong><span>离线</span></div>
          <div><ToolFilled /><strong>{faults}</strong><span>故障</span></div>
        </div>
      </section>

      <section className={styles.controlBar}>
        <div><label htmlFor="area-filter">装置区域</label><Select id="area-filter" value={areaId} onChange={setAreaId} options={[{ value: 'all', label: '全部装置' }, ...areas.map(([value, label]) => ({ value, label }))]} /></div>
        <Segmented value={state} onChange={(value) => setState(String(value))} options={['全部', '报警', '异常']} />
        <span className={styles.resultCount}>显示 {points.length} / {gdsPoints.length} 个测点</span>
      </section>

      <section className={styles.matrix} aria-label="GDS 探测器矩阵">
        {points.map((point) => (
          <DetectorCard key={point.id} point={point} onOpen={() => {
            const event = dashboard?.alarms.find((alarm) => alarm.source === 'GDS' && alarm.areaId === point.areaId);
            if (event) history.push(`/warnings/${event.id}`);
          }} />
        ))}
      </section>
      {points.length === 0 && <Empty description="当前筛选条件下没有测点" />}

      <footer className={styles.legend}>
        <span><CheckCircleFilled /> 正常</span><span className={styles.level1}><i /> 一级报警 ≥ 25%LEL</span><span className={styles.level2}><i /> 二级报警 ≥ 40%LEL</span><span className={styles.trend}><i /> 浓度上升</span>
      </footer>
    </PageContainer>
  );
}
