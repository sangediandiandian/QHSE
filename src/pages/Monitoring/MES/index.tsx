import type { MesTag, MesUnit } from '@/types/qhse';
import { isWarningScenarioEnabled } from '@/utils/warningRules';
import {
  AlertFilled,
  ApiOutlined,
  CheckCircleFilled,
  DashboardFilled,
  ExperimentFilled,
  FireFilled,
  NodeIndexOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useAccess, useModel } from '@umijs/max';
import { Button, Empty, Segmented, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const steps = ['进料', '加热', '分馏', '外送'] as const;
const stepMeta = {
  进料: { code: 'FEED', equipment: 'P-101 / V-101', description: '原油进料与电脱盐' },
  加热: { code: 'HEATING', equipment: 'F-201', description: '常压加热炉' },
  分馏: { code: 'FRACTION', equipment: 'T-301 / T-302', description: '常减压分馏系统' },
  外送: { code: 'TRANSFER', equipment: 'P-401', description: '产品外送与缓冲' },
};

function TagTrend({ tag }: { tag: MesTag }) {
  const range = Math.max(1, tag.upperLimit - tag.lowerLimit);
  const min = tag.lowerLimit - range * .2;
  const max = tag.upperLimit + range * .2;
  const y = (value: number) => 36 - ((value - min) / (max - min)) * 30;
  const points = tag.trend.map((value, index) => `${(index / (tag.trend.length - 1)) * 100},${y(value)}`).join(' ');
  return <svg className={`${styles.tagTrend} ${styles[tag.status]}`} viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden><line x1="0" y1={y(tag.upperLimit)} x2="100" y2={y(tag.upperLimit)} /><line x1="0" y1={y(tag.lowerLimit)} x2="100" y2={y(tag.lowerLimit)} /><polyline points={points} /></svg>;
}

function ParameterCard({ tag }: { tag: MesTag }) {
  return (
    <article className={`${styles.parameter} ${styles[tag.status]}`}>
      <header><span>{tag.code}</span><Tag bordered={false}>{tag.status === 'normal' ? '正常' : tag.status === 'warning' ? '接近边界' : tag.status === 'alarm' ? '参数异常' : '离线'}</Tag></header>
      <strong>{tag.currentValue}<em>{tag.unit}</em></strong>
      <TagTrend tag={tag} />
      <footer><span>{tag.name}</span><small>{tag.equipmentName}</small></footer>
    </article>
  );
}

export default function MesMonitoring() {
  const access = useAccess();
  const { dashboard, mesTags, gdsPoints, telemetryLoading, telemetryApiMode, telemetryRealtimeStatus, loadTelemetry, ingestTelemetrySample, simulateJointAlarm } = useModel('qhse');
  const [step, setStep] = useState('全部');
  useEffect(() => { void loadTelemetry(); }, [loadTelemetry]);

  const tags = useMemo(() => mesTags.filter((tag) => step === '全部' || tag.processStep === step), [mesTags, step]);
  if (telemetryLoading && !mesTags.length) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!mesTags.length) return <PageContainer><Empty description="MES 数据暂不可用" /></PageContainer>;

  const units: MesUnit[] = dashboard?.mesUnits ?? Array.from(new Map(mesTags.map((tag) => [tag.unitId, tag.unitName])).entries()).map(([id, name], index) => ({ id, code: `UNIT-${index + 1}`, name, load: 82, operatingMode: '稳定运行', status: mesTags.some((tag) => tag.unitId === id && tag.status === 'alarm') ? 'alarm' : 'normal' }));
  const cdu = units[0];
  const anomalies = mesTags.filter((tag) => tag.status === 'alarm').length;
  const warnings = mesTags.filter((tag) => tag.status === 'warning').length;
  const gdsPoint = gdsPoints.find((point) => point.id === 'gds-101');
  const jointEvent = dashboard?.alarms.find((event) => event.id === 'evt-joint-simulated');
  const jointTriggered = Boolean(jointEvent) || (telemetryApiMode && anomalies > 0 && ['level1', 'level2'].includes(gdsPoint?.alarmStatus ?? ''));
  const handleSimulation = async () => {
    if (telemetryApiMode) {
      const occurredAt = new Date().toISOString();
      await ingestTelemetrySample({ sampleId: `ui-mes-${Date.now()}`, pointId: 'mes-pt-101', source: 'MES', occurredAt, metrics: { value: 1.35 }, quality: 'good' });
      await ingestTelemetrySample({ sampleId: `ui-joint-gds-${Date.now()}`, pointId: 'gds-101', source: 'GDS', occurredAt, metrics: { gasConcentration: 42 }, quality: 'good' });
      message.warning('MES 与 GDS 样本已写入服务端并执行联合预警规则');
      return;
    }
    if (!dashboard || !isWarningScenarioEnabled(dashboard, 'joint-leak')) {
      message.info('GDS 与 MES 联合研判规则已停用，请先在预警规则页面启用');
      return;
    }
    simulateJointAlarm();
    message.warning('已触发 MES 与 GDS 联合异常，事件升级为重大预警');
  };

  return (
    <PageContainer title={false} className={styles.page} extra={[telemetryApiMode && <Tag key="realtime" color={telemetryRealtimeStatus === 'connected' ? 'success' : 'warning'}>实时通道：{telemetryRealtimeStatus === 'connected' ? '已连接' : '重连中'}</Tag>, <Button key="simulate" danger disabled={telemetryApiMode && !access.canIngestTelemetry} icon={<ThunderboltFilled />} onClick={() => void handleSimulation()}>模拟 GDS + MES 联合预警</Button>]}>
      <section className={styles.hero}>
        <div><span>MANUFACTURING EXECUTION SYSTEM</span><h1>MES 工艺数据关联</h1><p>生产负荷、设备参数与安全监测按装置和工艺节点统一关联。</p></div>
        <div className={styles.metrics}>
          <div><ApiOutlined /><strong>{units.length}/{units.length}</strong><span>在线装置</span></div>
          <div><DashboardFilled /><strong>{cdu.load}<em>%</em></strong><span>常减压负荷</span></div>
          <div className={styles.warningMetric}><ExperimentFilled /><strong>{warnings}</strong><span>边界参数</span></div>
          <div className={styles.alarmMetric}><AlertFilled /><strong>{anomalies}</strong><span>异常参数</span></div>
        </div>
      </section>

      <section className={styles.unitStrip}>
        {units.map((unit) => <article key={unit.id} className={styles[unit.status]}><span>{unit.code}</span><strong>{unit.name}</strong><em>{unit.load}% 负荷</em><small><i />{unit.operatingMode}</small></article>)}
      </section>

      <section className={styles.processPanel}>
        <header><div><span>CDU PROCESS CORRELATION</span><h2>常减压装置工艺流程</h2></div><small>点击阶段筛选下方参数</small></header>
        <div className={styles.processLine}>
          {steps.map((processStep, index) => {
            const stepTags = mesTags.filter((tag) => tag.processStep === processStep);
            const stepAlarm = stepTags.some((tag) => tag.status === 'alarm');
            return <button key={processStep} type="button" className={`${styles.processNode} ${stepAlarm ? styles.nodeAlarm : ''}`} onClick={() => setStep(processStep)}><span>{stepMeta[processStep].code}</span><strong>{processStep}</strong><small>{stepMeta[processStep].description}</small><em>{stepMeta[processStep].equipment}</em><i>{stepTags.length} 个参数</i>{index < steps.length - 1 && <b>→</b>}</button>;
          })}
        </div>
      </section>

      <section className={styles.correlation}>
        <article className={styles.gdsEvidence}>
          <header><div><span>SAFETY CORRELATION</span><h2>GDS 关联证据</h2></div><NodeIndexOutlined /></header>
          <div className={styles.evidenceValue}><span>GDS-101</span><strong>{gdsPoint?.currentValue ?? '--'}<em>%LEL</em></strong><Tag bordered={false}>{gdsPoint?.alarmStatus === 'level2' ? '二级报警' : gdsPoint?.alarmStatus === 'level1' ? '一级报警' : '运行正常'}</Tag></div>
          <div className={styles.evidenceLink}><span><FireFilled /> 泵区可燃气体</span><i>+</i><span><DashboardFilled /> 出口压力/流量</span><i>=</i><strong>{jointTriggered ? '疑似介质泄漏' : '未触发联合规则'}</strong></div>
          {jointEvent && <Button block danger onClick={() => history.push(`/warnings/${jointEvent.id}`)}>查看重大联合预警</Button>}
        </article>
        <article className={styles.ruleCard}><header><span>RULE · GDS_MES_01</span><Tag color={jointTriggered ? 'error' : 'success'}>{jointTriggered ? '已触发' : '监测中'}</Tag></header><h3>工艺介质泄漏联合研判</h3><p>泵出口压力升高或流量异常下降，同时附近 GDS 浓度持续上升，自动提升为重大预警。</p><div><span><CheckCircleFilled /> 空间距离 ≤ 50m</span><span><CheckCircleFilled /> 时间窗口 ≤ 5min</span><span><CheckCircleFilled /> 两类信号同时成立</span></div></article>
      </section>

      <section className={styles.parameterHead}><div><span>PROCESS PARAMETERS</span><h2>工艺参数矩阵</h2></div><Segmented value={step} onChange={(value) => setStep(String(value))} options={['全部', ...steps]} /></section>
      <section className={styles.parameterGrid}>{tags.map((tag) => <ParameterCard key={tag.id} tag={tag} />)}</section>
    </PageContainer>
  );
}
