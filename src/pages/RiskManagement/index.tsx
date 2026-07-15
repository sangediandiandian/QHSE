import type { RiskAssessmentInput, RiskControlRecord, RiskLevel, RiskUnit } from '@/types/qhse';
import { getLecRiskLevel } from '@/utils/riskWorkflow';
import { AlertFilled, ApartmentOutlined, DatabaseOutlined, LinkOutlined, PlusOutlined, SafetyCertificateFilled } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import { Button, Empty, Form, Input, InputNumber, Modal, Progress, Segmented, Select, Skeleton, Space, Tag, Tree, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const levelText: Record<RiskLevel, string> = { low: '低风险', medium: '一般风险', high: '较大风险', critical: '重大风险' };
const levelColor: Record<RiskLevel, string> = { low: 'success', medium: 'warning', high: 'orange', critical: 'error' };

function RiskItem({ unit, active, onClick }: { unit: RiskUnit; active: boolean; onClick: () => void }) {
  return <button type="button" className={active ? styles.active : ''} onClick={onClick}><i className={styles[unit.currentLevel]} /><span><code>{unit.code}</code><strong>{unit.name}</strong><small>{unit.areaName} · {unit.owner}</small></span><em><b>{levelText[unit.currentLevel]}</b><small>{levelText[unit.staticLevel]}</small></em></button>;
}

export default function RiskManagement() {
  const access = useAccess();
  const { dashboard, loading, loadDashboard, assessRiskUnit, saveRiskControls } = useModel('qhse');
  const [level, setLevel] = useState('全部');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('risk-001');
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [assessmentForm] = Form.useForm<RiskAssessmentInput>();
  const [controlsForm] = Form.useForm<{ controls: Array<Pick<RiskControlRecord, 'content' | 'owner' | 'status'>> }>();
  const likelihood = Form.useWatch('likelihood', assessmentForm) ?? 1;
  const exposure = Form.useWatch('exposure', assessmentForm) ?? 1;
  const consequence = Form.useWatch('consequence', assessmentForm) ?? 1;

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const units = useMemo(() => (dashboard?.riskUnits ?? []).filter((unit) => {
    const levelMatch = level === '全部' || levelText[unit.currentLevel] === level;
    const keyword = query.trim().toLowerCase();
    return levelMatch && (!keyword || `${unit.name}${unit.code}${unit.areaName}${unit.owner}`.toLowerCase().includes(keyword));
  }), [dashboard, level, query]);
  const selected = dashboard?.riskUnits.find((unit) => unit.id === selectedId) ?? units[0];
  const treeData = useMemo(() => (dashboard?.areas ?? []).map((area) => ({
    title: area.name,
    key: `area:${area.id}`,
    children: Array.from(new Set((dashboard?.riskUnits ?? []).filter((unit) => unit.areaId === area.id).map((unit) => unit.parentName))).map((parentName) => ({
      title: parentName,
      key: `parent:${area.id}:${parentName}`,
      children: (dashboard?.riskUnits ?? []).filter((unit) => unit.areaId === area.id && unit.parentName === parentName).map((unit) => ({ title: unit.name, key: unit.id })),
    })),
  })).filter((area) => area.children.length > 0), [dashboard]);

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
          <header><span>风险组织树 / 单元</span><small>当前 / 固有</small></header>
          <div className={styles.riskTree}><Tree treeData={treeData} defaultExpandAll selectedKeys={selected ? [selected.id] : []} onSelect={(keys) => { const key = String(keys[0] ?? ''); if (dashboard.riskUnits.some((unit) => unit.id === key)) setSelectedId(key); }} /></div>
          {units.map((unit) => <RiskItem key={unit.id} unit={unit} active={selected?.id === unit.id} onClick={() => setSelectedId(unit.id)} />)}
          {units.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的风险单元" />}
        </section>

        {selected && <section className={styles.detail}>
          <header><div><code>{selected.code}</code><h2>{selected.name}</h2><p>{selected.parentName} · {selected.areaName}</p></div><Space wrap><Button disabled={!access.canAssessRisk} onClick={() => { assessmentForm.setFieldsValue({ likelihood: 3, exposure: 3, consequence: 7, assessor: selected.owner, basis: '现场设备、介质与实时风险因子综合评估' }); setAssessmentOpen(true); }}>风险评估</Button><Button disabled={!access.canUpdateRiskControls} type="primary" onClick={() => { controlsForm.setFieldsValue({ controls: selected.controlRecords?.length ? selected.controlRecords.map(({ content, owner, status }) => ({ content, owner, status })) : selected.controls.map((content) => ({ content, owner: selected.owner, status: '有效' as const })) }); setControlsOpen(true); }}>维护措施</Button><Tag color={levelColor[selected.currentLevel]}>{levelText[selected.currentLevel]}</Tag></Space></header>
          <div className={styles.levelCompare}>
            <div><span>固有风险</span><strong>{levelText[selected.staticLevel]}</strong><Progress percent={{ low: 25, medium: 50, high: 75, critical: 100 }[selected.staticLevel]} showInfo={false} strokeColor="#78909a" /></div>
            <b>→</b>
            <div><span>实时风险</span><strong className={styles[selected.currentLevel]}>{levelText[selected.currentLevel]}</strong><Progress percent={{ low: 25, medium: 50, high: 75, critical: 100 }[selected.currentLevel]} showInfo={false} status={selected.currentLevel === 'critical' ? 'exception' : 'active'} /></div>
          </div>
          <dl className={styles.meta}><div><dt>责任部门</dt><dd>{selected.ownerDepartment}</dd></div><div><dt>责任人</dt><dd>{selected.owner}</dd></div><div><dt>危险介质</dt><dd>{selected.medium}</dd></div><div><dt>事故类型</dt><dd>{selected.accidentTypes.join(' / ')}</dd></div></dl>
          <div className={styles.assessment}><h3>LEC 评估记录</h3>{selected.assessments?.length ? [...selected.assessments].reverse().slice(0, 3).map((item) => <p key={item.id}><span><strong>{item.score}</strong><Tag color={levelColor[item.level]}>{levelText[item.level]}</Tag></span><small>L {item.likelihood} × E {item.exposure} × C {item.consequence} · {item.assessor} · {item.assessedAt}</small><em>{item.basis}</em></p>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无评估记录" />}</div>
          <div className={styles.factors}><h3>动态风险因子</h3>{selected.dynamicFactors.map((factor) => <article key={`${factor.source}-${factor.label}`}><i className={factor.impact === 'up' ? styles.up : styles.watch} /><Tag>{factor.source}</Tag><span><strong>{factor.label}</strong><small>{factor.status}</small></span></article>)}</div>
          <div className={styles.links}><h3><LinkOutlined /> 关联对象</h3><span>GDS<strong>{selected.linkedGds}</strong></span><span>VOC<strong>{selected.linkedVoc}</strong></span><span>MES<strong>{selected.linkedMes}</strong></span><span>应急预案<strong>{selected.linkedPlans}</strong></span></div>
          <div className={styles.controls}><h3>管控措施</h3>{(selected.controlRecords?.length ? selected.controlRecords : selected.controls.map((content, index) => ({ id: `${selected.id}-${index}`, content, owner: selected.owner, status: '有效' as const, updatedAt: '-' }))).map((control, index) => <p key={control.id}><i>{String(index + 1).padStart(2, '0')}</i><span>{control.content}<small>{control.owner} · {control.updatedAt}</small></span><Tag color={control.status === '有效' ? 'success' : 'warning'}>{control.status}</Tag></p>)}</div>
        </section>}
      </main>

      <Modal title={`LEC 风险评估 · ${selected?.name ?? ''}`} open={assessmentOpen} onCancel={() => setAssessmentOpen(false)} onOk={() => assessmentForm.validateFields().then((values) => { if (!selected) return; assessRiskUnit(selected.id, values); setAssessmentOpen(false); message.success('风险评估已完成'); })} okText="完成评估">
        <Form form={assessmentForm} layout="vertical">
          <div className={styles.formGrid}><Form.Item name="likelihood" label="L 事故可能性" rules={[{ required: true }]}><InputNumber min={1} max={10} /></Form.Item><Form.Item name="exposure" label="E 暴露频率" rules={[{ required: true }]}><InputNumber min={1} max={10} /></Form.Item><Form.Item name="consequence" label="C 后果严重度" rules={[{ required: true }]}><InputNumber min={1} max={100} /></Form.Item></div>
          <div className={styles.scorePreview}><span>LEC 风险值</span><strong>{likelihood * exposure * consequence}</strong><Tag color={levelColor[getLecRiskLevel(likelihood * exposure * consequence)]}>{levelText[getLecRiskLevel(likelihood * exposure * consequence)]}</Tag></div>
          <Form.Item name="assessor" label="评估人" rules={[{ required: true, message: '请填写评估人' }]}><Input /></Form.Item><Form.Item name="basis" label="评估依据" rules={[{ required: true, message: '请填写评估依据' }]}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal width={720} title={`管控措施 · ${selected?.name ?? ''}`} open={controlsOpen} onCancel={() => setControlsOpen(false)} onOk={() => controlsForm.validateFields().then(({ controls }) => { if (!selected) return; saveRiskControls(selected.id, controls); setControlsOpen(false); message.success('管控措施已更新'); })} okText="保存措施">
        <Form form={controlsForm} layout="vertical"><Form.List name="controls">{(fields, { add, remove }) => <><div className={styles.controlFormHeader}><span>措施内容</span><span>责任人</span><span>状态</span></div>{fields.map((field) => <Space key={field.key} className={styles.controlForm} align="start"><Form.Item name={[field.name, 'content']} rules={[{ required: true, message: '请填写措施' }]}><Input placeholder="管控措施" /></Form.Item><Form.Item name={[field.name, 'owner']} rules={[{ required: true, message: '请填写责任人' }]}><Input placeholder="责任人" /></Form.Item><Form.Item name={[field.name, 'status']}><Select options={[{ value: '有效' }, { value: '待验证' }]} /></Form.Item><Button danger onClick={() => remove(field.name)}>移除</Button></Space>)}<Button block icon={<PlusOutlined />} onClick={() => add({ owner: selected?.owner, status: '待验证' })}>添加管控措施</Button></>}</Form.List></Form>
      </Modal>
    </PageContainer>
  );
}
