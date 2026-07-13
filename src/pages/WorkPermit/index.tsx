import type { WorkPermit as WorkPermitType, WorkPermitInput, WorkPermitSiteConfirmation, WorkPermitStatus } from '@/types/qhse';
import { calculatePermitNearestGdsDistance, getWorkPermitApprovalSteps } from '@/utils/workPermitWorkflow';
import { isWarningScenarioEnabled } from '@/utils/warningRules';
import { AlertFilled, CheckCircleFilled, EnvironmentFilled, ExperimentFilled, FileAddFilled, PauseCircleFilled, SafetyCertificateFilled, ThunderboltFilled } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Empty, Form, Input, InputNumber, Modal, Segmented, Select, Skeleton, Space, Steps, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const statusColor: Record<WorkPermitStatus, string> = { 待审批: 'default', 作业中: 'processing', 建议暂停: 'error', 已暂停: 'warning', 已关闭: 'success' };

function PermitItem({ permit, active, onClick }: { permit: WorkPermitType; active: boolean; onClick: () => void }) {
  return <button type="button" className={`${active ? styles.active : ''} ${permit.status === '建议暂停' ? styles.needsAction : ''}`} onClick={onClick}><div><Tag color={permit.riskLevel === '重大' ? 'error' : permit.riskLevel === '较大' ? 'orange' : 'default'}>{permit.riskLevel}</Tag><code>{permit.code}</code></div><strong>{permit.type} · {permit.workContent}</strong><p>{permit.areaName}<span>{permit.startAt} — {permit.endAt}</span></p><footer><span>监护：{permit.guardian}</span><Tag color={statusColor[permit.status]}>{permit.status}</Tag></footer></button>;
}

function PermitDetail({ permit, gdsPoints, onAdvance, onApprove, onConfirm }: { permit: WorkPermitType; gdsPoints: Parameters<typeof calculatePermitNearestGdsDistance>[1]; onAdvance: () => void; onApprove: () => void; onConfirm: (role: WorkPermitSiteConfirmation['role']) => void }) {
  const actionable = permit.status === '建议暂停' || permit.status === '已暂停';
  const approvalSteps = getWorkPermitApprovalSteps(permit);
  const nextApproval = approvalSteps.find((step) => step.status === '待审批');
  const fullyApproved = approvalSteps.every((step) => step.status === '已通过');
  const confirmations = permit.siteConfirmations ?? [];
  const distance = calculatePermitNearestGdsDistance(permit, gdsPoints);
  return <section className={styles.detail}>
    <header><div><code>{permit.code}</code><h2>{permit.workContent}</h2><p>{permit.type} · {permit.areaName}</p></div><Tag color={statusColor[permit.status]}>{permit.status}</Tag></header>
    {permit.alertReason && <div className={styles.alert}><AlertFilled /><span><strong>动态告警联动</strong><small>{permit.alertReason}</small></span></div>}
    <dl><div><dt>申请人</dt><dd>{permit.applicant}</dd></div><div><dt>现场监护</dt><dd>{permit.guardian}</dd></div><div><dt>计划时间</dt><dd>{permit.startAt} — {permit.endAt}</dd></div><div><dt>作业风险</dt><dd>{permit.riskLevel}</dd></div></dl>
    <section className={styles.gas}><h3><ExperimentFilled /> 气体检测</h3><strong>{permit.gasTest}</strong><small>关联探测器：{permit.linkedGdsCodes.join('、') || '无'}</small></section>
    <section className={`${styles.distance} ${distance !== undefined && distance < 50 ? styles.distanceDanger : ''}`}><EnvironmentFilled /><span><strong>{distance === undefined ? '待标定' : `${distance} m`}</strong><small>作业点至同区域最近 GDS 探测器{distance !== undefined && distance < 50 ? '，需加强连续监测' : ''}</small></span></section>
    <section className={styles.approval}><h3>三级审批与电子签名</h3><Steps size="small" direction="vertical" items={approvalSteps.map((step) => ({ status: step.status === '已通过' ? 'finish' : 'process', title: step.role, description: step.status === '已通过' ? `${step.signature} · ${step.signedAt}` : `${step.approver} 待签署` }))} />{nextApproval && <Button block onClick={onApprove}>以 {nextApproval.approver} 身份确认签署·{nextApproval.role}</Button>}</section>
    {fullyApproved && permit.status === '待审批' && <section className={styles.siteConfirm}><h3>现场双人确认</h3>{(['作业负责人', '现场监护人'] as WorkPermitSiteConfirmation['role'][]).map((role) => { const record = confirmations.find((item) => item.role === role); return <div key={role}><span><strong>{role}</strong><small>{record ? `${record.confirmer} · ${record.confirmedAt}` : '未确认'}</small></span><Button size="small" disabled={Boolean(record)} onClick={() => onConfirm(role)}>{record ? '已确认' : '现场确认'}</Button></div>; })}</section>}
    <section className={styles.measures}><h3>安全措施确认</h3>{permit.safetyMeasures.map((measure) => <p key={measure}><CheckCircleFilled /><span>{measure}</span><Tag color="success">已确认</Tag></p>)}</section>
    {actionable && <Button block danger={permit.status === '建议暂停'} type="primary" icon={permit.status === '建议暂停' ? <PauseCircleFilled /> : <ExperimentFilled />} onClick={onAdvance}>{permit.status === '建议暂停' ? '确认暂停作业' : '复测合格并恢复作业'}</Button>}
  </section>;
}

export default function WorkPermit() {
  const { dashboard, loading, loadDashboard, triggerPermitLinkage, advanceWorkPermit, addWorkPermit, approveWorkPermit, confirmWorkPermitSite } = useModel('qhse');
  const [status, setStatus] = useState('全部');
  const [selectedId, setSelectedId] = useState('permit-001');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm<WorkPermitInput>();
  const selectedAreaId = Form.useWatch('areaId', createForm);

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
    <PageContainer title={false} className={styles.page} extra={<Space><Button icon={<FileAddFilled />} onClick={() => { createForm.setFieldsValue({ type: '动火作业', riskLevel: '较大', startAt: '2026-07-14 09:00', endAt: '2026-07-14 17:00', gasTest: '可燃气体 0%LEL，氧含量 20.9%VOL', linkedGdsCodes: [], safetyMeasures: [], workX: 50, workY: 50 }); setCreateOpen(true); }}>申请作业票</Button><Button type="primary" icon={<ThunderboltFilled />} onClick={runLinkage}>运行告警联动检查</Button></Space>}>
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
        {selected && <PermitDetail permit={selected} gdsPoints={dashboard.gdsPoints} onApprove={() => { approveWorkPermit(selected.id); message.success('当前审批节点已签署'); }} onConfirm={(role) => { confirmWorkPermitSite(selected.id, role); message.success(`${role}已完成现场确认`); }} onAdvance={() => {
          advanceWorkPermit(selected.id);
          message.success(selected.status === '建议暂停' ? '已确认暂停，现场作业应立即停止' : '气体复测合格，已恢复作业');
        }} />}
      </main>

      <Modal width={720} title="申请作业票" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.validateFields().then((values) => { const area = dashboard.areas.find((item) => item.id === values.areaId); if (!area) return; addWorkPermit({ ...values, areaName: area.name }); setCreateOpen(false); createForm.resetFields(); message.success('作业票已提交，进入三级审批'); })} okText="提交申请">
        <Form form={createForm} layout="vertical"><div className={styles.formGrid}><Form.Item name="type" label="作业类型" rules={[{ required: true }]}><Select options={['动火作业', '受限空间', '高处作业', '吊装作业', '临时用电'].map((value) => ({ value }))} /></Form.Item><Form.Item name="areaId" label="作业区域" rules={[{ required: true }]}><Select options={dashboard.areas.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item><Form.Item name="applicant" label="申请人" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="guardian" label="现场监护人" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="startAt" label="计划开始" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="endAt" label="计划结束" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="riskLevel" label="作业风险" rules={[{ required: true }]}><Select options={['一般', '较大', '重大'].map((value) => ({ value }))} /></Form.Item><Form.Item name="linkedGdsCodes" label="关联 GDS 探测器"><Select mode="multiple" options={dashboard.gdsPoints.filter((item) => !selectedAreaId || item.areaId === selectedAreaId).map((item) => ({ value: item.code, label: `${item.code} / ${item.name}` }))} /></Form.Item><Form.Item name="workX" label="作业点 X 坐标" rules={[{ required: true }]}><InputNumber min={0} max={100} /></Form.Item><Form.Item name="workY" label="作业点 Y 坐标" rules={[{ required: true }]}><InputNumber min={0} max={100} /></Form.Item></div><Form.Item name="workContent" label="作业内容" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item><Form.Item name="gasTest" label="气体检测结果" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="safetyMeasures" label="安全措施" rules={[{ required: true }]}><Select mode="tags" placeholder="输入措施后回车" /></Form.Item><p className={styles.formHint}>坐标用于演示作业点与 GDS 点位的相对距离；正式系统应由 GIS/平面图点选生成。</p></Form>
      </Modal>
    </PageContainer>
  );
}
