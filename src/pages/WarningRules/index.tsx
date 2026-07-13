import type { RiskLevel, WarningRule } from '@/types/qhse';
import {
  AlertFilled,
  CheckCircleFilled,
  ControlFilled,
  DatabaseFilled,
  HistoryOutlined,
  NotificationFilled,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Empty, Popconfirm, Segmented, Skeleton, Switch, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const levelText: Record<RiskLevel, string> = { low: '低风险', medium: '一般', high: '较大', critical: '重大' };
const levelColor: Record<RiskLevel, string> = { low: 'success', medium: 'warning', high: 'orange', critical: 'error' };

function RuleItem({ rule, active, onSelect, onToggle }: {
  rule: WarningRule;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return <article className={`${active ? styles.active : ''} ${!rule.enabled ? styles.disabled : ''}`}>
    <button type="button" className={styles.ruleSelect} onClick={onSelect}>
      <header><Tag color={levelColor[rule.level]}>{levelText[rule.level]}</Tag><code>{rule.code}</code><span>{rule.source}</span></header>
      <strong>{rule.name}</strong>
      <p>{rule.condition}</p>
      <footer><span><HistoryOutlined /> {rule.lastTriggeredAt ?? '尚未触发'}</span><em>{rule.triggerCount} 次</em></footer>
    </button>
    <Switch aria-label={`切换 ${rule.code}`} size="small" checked={rule.enabled} onChange={onToggle} checkedChildren="启" unCheckedChildren="停" />
  </article>;
}

export default function WarningRules() {
  const { dashboard, loading, loadDashboard, toggleWarningRule, resetDashboard } = useModel('qhse');
  const [source, setSource] = useState('全部');
  const [selectedId, setSelectedId] = useState('rule-001');

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const rules = useMemo(() => (dashboard?.warningRules ?? []).filter((rule) => source === '全部' || rule.source === source), [dashboard, source]);
  const selected = dashboard?.warningRules.find((rule) => rule.id === selectedId) ?? rules[0];

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="预警规则数据暂不可用" /></PageContainer>;

  const enabled = dashboard.warningRules.filter((rule) => rule.enabled).length;
  const critical = dashboard.warningRules.filter((rule) => rule.level === 'critical').length;
  const triggers = dashboard.warningRules.reduce((sum, rule) => sum + rule.triggerCount, 0);

  return (
    <PageContainer title={false} className={styles.page} extra={<Popconfirm title="恢复 Mock 初始状态？" description="将清除浏览器中保存的告警、隐患、票证和规则操作。" okText="确认重置" cancelText="取消" onConfirm={() => { void resetDashboard(); message.success('演示数据已恢复初始状态'); }}><Button icon={<ReloadOutlined />}>重置演示数据</Button></Popconfirm>}>
      <header className={styles.heading}>
        <div><span>WARNING RULE ORCHESTRATION</span><h1>预警规则配置</h1><p>统一管理单点阈值、持续时间、多源组合、作用范围和通知对象。</p></div>
        <div className={styles.persistence}><DatabaseFilled /><span>原型状态存储<strong>本地持久化已启用</strong><small>规则与业务操作刷新后保留</small></span></div>
      </header>

      <section className={styles.metrics}>
        <div><ControlFilled /><span>规则总数<strong>{dashboard.warningRules.length}</strong><small>覆盖 5 类联动场景</small></span></div>
        <div><CheckCircleFilled /><span>启用规则<strong>{enabled}</strong><small>{dashboard.warningRules.length - enabled} 条已停用</small></span></div>
        <div><AlertFilled /><span>重大规则<strong>{critical}</strong><small>触发后立即升级</small></span></div>
        <div><NotificationFilled /><span>累计触发<strong>{triggers}</strong><small>演示统计次数</small></span></div>
      </section>

      <section className={styles.toolbar}><Segmented value={source} onChange={(value) => setSource(String(value))} options={['全部', 'GDS', 'VOC', 'MES', '联合预警', '作业许可']} /><span>显示 {rules.length} / {dashboard.warningRules.length} 条规则</span></section>

      <main className={styles.layout}>
        <section className={styles.catalog}>{rules.map((rule) => <RuleItem key={rule.id} rule={rule} active={selected?.id === rule.id} onSelect={() => setSelectedId(rule.id)} onToggle={() => { toggleWarningRule(rule.id); message.success(`${rule.name}已${rule.enabled ? '停用' : '启用'}`); }} />)}{rules.length === 0 && <Empty description="没有符合条件的规则" />}</section>
        {selected && <section className={styles.detail}>
          <header><div><code>{selected.code}</code><h2>{selected.name}</h2><p>{selected.description}</p></div><Switch aria-label={`详情切换 ${selected.code}`} checked={selected.enabled} onChange={() => toggleWarningRule(selected.id)} checkedChildren="已启用" unCheckedChildren="已停用" /></header>
          <div className={styles.ruleExpression}><span>IF</span><strong>{selected.condition}</strong><i>AND</i><strong>{selected.duration}</strong><em>THEN</em><b>{levelText[selected.level]}预警</b></div>
          <dl><div><dt>数据来源</dt><dd>{selected.source}</dd></div><div><dt>作用范围</dt><dd>{selected.scope}</dd></div><div><dt>风险等级</dt><dd><Tag color={levelColor[selected.level]}>{levelText[selected.level]}</Tag></dd></div><div><dt>运行状态</dt><dd><Tag color={selected.enabled ? 'success' : 'default'}>{selected.enabled ? '运行中' : '已停用'}</Tag></dd></div></dl>
          <section className={styles.targets}><h3>通知对象</h3><div>{selected.notifyTargets.map((target, index) => <span key={target}><i>{index + 1}</i><strong>{target}</strong>{index < selected.notifyTargets.length - 1 && <em>→</em>}</span>)}</div></section>
          <section className={styles.history}><h3>运行记录</h3><div><span>累计触发</span><strong>{selected.triggerCount}<em>次</em></strong></div><div><span>最近触发</span><strong>{selected.lastTriggeredAt ?? '尚未触发'}</strong></div><p><CheckCircleFilled /> 配置变更会立即保存至当前浏览器，并影响对应模拟场景。</p></section>
        </section>}
      </main>
    </PageContainer>
  );
}
