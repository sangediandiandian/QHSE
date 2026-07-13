import type { RiskLevel, RiskUnit } from '@/types/qhse';
import { AlertFilled, ApartmentOutlined, DatabaseOutlined, LinkOutlined, SafetyCertificateFilled } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Empty, Input, Progress, Segmented, Skeleton, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const levelText: Record<RiskLevel, string> = { low: '低风险', medium: '一般风险', high: '较大风险', critical: '重大风险' };
const levelColor: Record<RiskLevel, string> = { low: 'success', medium: 'warning', high: 'orange', critical: 'error' };

function RiskItem({ unit, active, onClick }: { unit: RiskUnit; active: boolean; onClick: () => void }) {
  return <button type="button" className={active ? styles.active : ''} onClick={onClick}><i className={styles[unit.currentLevel]} /><span><code>{unit.code}</code><strong>{unit.name}</strong><small>{unit.areaName} · {unit.owner}</small></span><em><b>{levelText[unit.currentLevel]}</b><small>{levelText[unit.staticLevel]}</small></em></button>;
}

export default function RiskManagement() {
  const { dashboard, loading, loadDashboard } = useModel('qhse');
  const [level, setLevel] = useState('全部');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('risk-001');

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const units = useMemo(() => (dashboard?.riskUnits ?? []).filter((unit) => {
    const levelMatch = level === '全部' || levelText[unit.currentLevel] === level;
    const keyword = query.trim().toLowerCase();
    return levelMatch && (!keyword || `${unit.name}${unit.code}${unit.areaName}${unit.owner}`.toLowerCase().includes(keyword));
  }), [dashboard, level, query]);
  const selected = dashboard?.riskUnits.find((unit) => unit.id === selectedId) ?? units[0];

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="风险数据暂不可用" /></PageContainer>;

  const major = dashboard.riskUnits.filter((unit) => ['high', 'critical'].includes(unit.currentLevel)).length;
  const elevated = dashboard.riskUnits.filter((unit) => unit.currentLevel !== unit.staticLevel).length;
  const linked = dashboard.riskUnits.reduce((sum, unit) => sum + unit.linkedGds + unit.linkedVoc + unit.linkedMes, 0);

  return (
    <PageContainer title={false} className={styles.page}>
      <header className={styles.heading}>
        <div><span>RISK HIERARCHY CONTROL</span><h1>风险分级管控</h1><p>从固有风险到实时风险，统一关联监测、隐患、票证和应急控制措施。</p></div>
        <div className={styles.status}><i /><span>全厂风险态势<strong>{dashboard.metrics.overallRisk}</strong><small>{elevated} 个单元发生动态偏移</small></span></div>
      </header>

      <section className={styles.metrics}>
        <div><SafetyCertificateFilled /><span>风险单元<strong>{dashboard.riskUnits.length}</strong><small>已建立分级清单</small></span></div>
        <div><AlertFilled /><span>较大及以上<strong>{major}</strong><small>需重点管控</small></span></div>
        <div><ApartmentOutlined /><span>动态升级<strong>{elevated}</strong><small>受实时因素影响</small></span></div>
        <div><DatabaseOutlined /><span>监测关联<strong>{linked}</strong><small>GDS / VOC / MES 点位</small></span></div>
      </section>

      <section className={styles.toolbar}>
        <Segmented value={level} onChange={(value) => setLevel(String(value))} options={['全部', '低风险', '一般风险', '较大风险', '重大风险']} />
        <Input.Search allowClear value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单元、区域或责任人" />
        <span>显示 {units.length} / {dashboard.riskUnits.length} 个单元</span>
      </section>

      <main className={styles.layout}>
        <section className={styles.catalog}>
          <header><span>风险单元</span><small>当前 / 固有</small></header>
          {units.map((unit) => <RiskItem key={unit.id} unit={unit} active={selected?.id === unit.id} onClick={() => setSelectedId(unit.id)} />)}
          {units.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的风险单元" />}
        </section>

        {selected && <section className={styles.detail}>
          <header><div><code>{selected.code}</code><h2>{selected.name}</h2><p>{selected.parentName} · {selected.areaName}</p></div><Tag color={levelColor[selected.currentLevel]}>{levelText[selected.currentLevel]}</Tag></header>
          <div className={styles.levelCompare}>
            <div><span>固有风险</span><strong>{levelText[selected.staticLevel]}</strong><Progress percent={{ low: 25, medium: 50, high: 75, critical: 100 }[selected.staticLevel]} showInfo={false} strokeColor="#78909a" /></div>
            <b>→</b>
            <div><span>实时风险</span><strong className={styles[selected.currentLevel]}>{levelText[selected.currentLevel]}</strong><Progress percent={{ low: 25, medium: 50, high: 75, critical: 100 }[selected.currentLevel]} showInfo={false} status={selected.currentLevel === 'critical' ? 'exception' : 'active'} /></div>
          </div>
          <dl className={styles.meta}><div><dt>责任部门</dt><dd>{selected.ownerDepartment}</dd></div><div><dt>责任人</dt><dd>{selected.owner}</dd></div><div><dt>危险介质</dt><dd>{selected.medium}</dd></div><div><dt>事故类型</dt><dd>{selected.accidentTypes.join(' / ')}</dd></div></dl>
          <div className={styles.factors}><h3>动态风险因子</h3>{selected.dynamicFactors.map((factor) => <article key={`${factor.source}-${factor.label}`}><i className={factor.impact === 'up' ? styles.up : styles.watch} /><Tag>{factor.source}</Tag><span><strong>{factor.label}</strong><small>{factor.status}</small></span></article>)}</div>
          <div className={styles.links}><h3><LinkOutlined /> 关联对象</h3><span>GDS<strong>{selected.linkedGds}</strong></span><span>VOC<strong>{selected.linkedVoc}</strong></span><span>MES<strong>{selected.linkedMes}</strong></span><span>应急预案<strong>{selected.linkedPlans}</strong></span></div>
          <div className={styles.controls}><h3>管控措施</h3>{selected.controls.map((control, index) => <p key={control}><i>{String(index + 1).padStart(2, '0')}</i><span>{control}</span><Tag color="success">有效</Tag></p>)}</div>
        </section>}
      </main>
    </PageContainer>
  );
}
