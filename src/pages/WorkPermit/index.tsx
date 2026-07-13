import type { WorkPermit as WorkPermitType, WorkPermitStatus } from '@/types/qhse';
import { isWarningScenarioEnabled } from '@/utils/warningRules';
import { AlertFilled, CheckCircleFilled, ExperimentFilled, PauseCircleFilled, SafetyCertificateFilled, ThunderboltFilled } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Empty, Segmented, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const statusColor: Record<WorkPermitStatus, string> = { 待审批: 'default', 作业中: 'processing', 建议暂停: 'error', 已暂停: 'warning', 已关闭: 'success' };

function PermitItem({ permit, active, onClick }: { permit: WorkPermitType; active: boolean; onClick: () => void }) {
  return <button type="button" className={`${active ? styles.active : ''} ${permit.status === '建议暂停' ? styles.needsAction : ''}`} onClick={onClick}><div><Tag color={permit.riskLevel === '重大' ? 'error' : permit.riskLevel === '较大' ? 'orange' : 'default'}>{permit.riskLevel}</Tag><code>{permit.code}</code></div><strong>{permit.type} · {permit.workContent}</strong><p>{permit.areaName}<span>{permit.startAt} — {permit.endAt}</span></p><footer><span>监护：{permit.guardian}</span><Tag color={statusColor[permit.status]}>{permit.status}</Tag></footer></button>;
}

function PermitDetail({ permit, onAdvance }: { permit: WorkPermitType; onAdvance: () => void }) {
  const actionable = permit.status === '建议暂停' || permit.status === '已暂停';
  return <section className={styles.detail}>
    <header><div><code>{permit.code}</code><h2>{permit.workContent}</h2><p>{permit.type} · {permit.areaName}</p></div><Tag color={statusColor[permit.status]}>{permit.status}</Tag></header>
    {permit.alertReason && <div className={styles.alert}><AlertFilled /><span><strong>动态告警联动</strong><small>{permit.alertReason}</small></span></div>}
    <dl><div><dt>申请人</dt><dd>{permit.applicant}</dd></div><div><dt>现场监护</dt><dd>{permit.guardian}</dd></div><div><dt>计划时间</dt><dd>{permit.startAt} — {permit.endAt}</dd></div><div><dt>作业风险</dt><dd>{permit.riskLevel}</dd></div></dl>
    <section className={styles.gas}><h3><ExperimentFilled /> 气体检测</h3><strong>{permit.gasTest}</strong><small>关联探测器：{permit.linkedGdsCodes.join('、') || '无'}</small></section>
    <section className={styles.measures}><h3>安全措施确认</h3>{permit.safetyMeasures.map((measure) => <p key={measure}><CheckCircleFilled /><span>{measure}</span><Tag color="success">已确认</Tag></p>)}</section>
    {actionable && <Button block danger={permit.status === '建议暂停'} type="primary" icon={permit.status === '建议暂停' ? <PauseCircleFilled /> : <ExperimentFilled />} onClick={onAdvance}>{permit.status === '建议暂停' ? '确认暂停作业' : '复测合格并恢复作业'}</Button>}
  </section>;
}

export default function WorkPermit() {
  const { dashboard, loading, loadDashboard, triggerPermitLinkage, advanceWorkPermit } = useModel('qhse');
  const [status, setStatus] = useState('全部');
  const [selectedId, setSelectedId] = useState('permit-001');

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const permits = useMemo(() => (dashboard?.workPermits ?? []).filter((permit) => status === '全部' || permit.status === status), [dashboard, status]);
  const selected = dashboard?.workPermits.find((permit) => permit.id === selectedId) ?? permits[0];

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="作业许可数据暂不可用" /></PageContainer>;

  const operating = dashboard.workPermits.filter((item) => item.status === '作业中').length;
  const highRisk = dashboard.workPermits.filter((item) => ['较大', '重大'].includes(item.riskLevel) && item.status !== '已关闭').length;
  const linkedAreas = new Set(dashboard.alarms.filter((alarm) => ['high', 'critical'].includes(alarm.level)).map((alarm) => alarm.areaId));
  const candidates = dashboard.workPermits.filter((permit) => permit.status === '作业中' && linkedAreas.has(permit.areaId)).length;
  const paused = dashboard.workPermits.filter((item) => ['建议暂停', '已暂停'].includes(item.status)).length;
  const linkageEnabled = isWarningScenarioEnabled(dashboard, 'permit-linkage');

  const runLinkage = () => {
    if (!linkageEnabled) {
      message.info('高风险作业告警联动规则已停用，请先在预警规则页面启用');
      return;
    }
    triggerPermitLinkage();
    message[candidates ? 'warning' : 'success'](candidates ? `发现 ${candidates} 张在办票证命中较大及以上告警，已生成暂停建议` : '联动检查完成，暂无需暂停的作业');
  };

  return (
    <PageContainer title={false} className={styles.page} extra={<Button type="primary" icon={<ThunderboltFilled />} onClick={runLinkage}>运行告警联动检查</Button>}>
      <header className={styles.heading}><div><span>WORK PERMIT CONTROL</span><h1>作业许可与联动管控</h1><p>集中管理高风险作业审批、气体检测、现场监护，并接收实时告警联动建议。</p></div><div className={paused ? styles.alertState : styles.safeState}><i /><span>联动管控状态<strong>{paused ? `${paused} 张票证需处置` : '规则已启用'}</strong><small>同区域较大及以上告警自动检查</small></span></div></header>

      <section className={styles.metrics}>
        <div><SafetyCertificateFilled /><span>今日票证<strong>{dashboard.workPermits.length}</strong><small>全部作业类型</small></span></div>
        <div><ExperimentFilled /><span>作业中<strong>{operating}</strong><small>持续接受动态监测</small></span></div>
        <div><AlertFilled /><span>较大及以上<strong>{highRisk}</strong><small>重点监管票证</small></span></div>
        <div className={paused ? styles.warningMetric : ''}><PauseCircleFilled /><span>暂停处置<strong>{paused}</strong><small>建议或已确认暂停</small></span></div>
      </section>

      <section className={styles.linkage}><div><ThunderboltFilled /><span><strong>告警联动规则</strong><small>较大及以上 GDS / VOC / MES 告警 + 同区域“作业中”票证 → 生成暂停建议，由现场负责人确认。</small></span></div><Tag color={linkageEnabled ? 'success' : 'default'}>{linkageEnabled ? '运行中' : '已停用'}</Tag><Button onClick={runLinkage}>立即检查</Button></section>
      <section className={styles.toolbar}><Segmented value={status} onChange={(value) => setStatus(String(value))} options={['全部', '待审批', '作业中', '建议暂停', '已暂停', '已关闭']} /><span>显示 {permits.length} / {dashboard.workPermits.length} 张票证</span></section>

      <main className={styles.layout}>
        <section className={styles.catalog}>
          {permits.map((permit) => <PermitItem key={permit.id} permit={permit} active={selected?.id === permit.id} onClick={() => setSelectedId(permit.id)} />)}
          {permits.length === 0 && <Empty description="没有符合条件的作业票证" />}
        </section>
        {selected && <PermitDetail permit={selected} onAdvance={() => {
          advanceWorkPermit(selected.id);
          message.success(selected.status === '建议暂停' ? '已确认暂停，现场作业应立即停止' : '气体复测合格，已恢复作业');
        }} />}
      </main>
    </PageContainer>
  );
}
