import type { Hazard, HazardEvidence, HazardInput, HazardStatus } from '@/types/qhse';
import { CheckCircleFilled, ClockCircleFilled, ExclamationCircleFilled, FileAddOutlined, SearchOutlined, SyncOutlined, WarningFilled } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Descriptions, Empty, Form, Input, Modal, Segmented, Select, Skeleton, Space, Tag, Timeline, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const statusColor: Record<HazardStatus, string> = { 待整改: 'error', 整改中: 'processing', 待验收: 'warning', 已关闭: 'success' };
const actionText: Record<HazardStatus, string> = { 待整改: '开始整改', 整改中: '提交验收', 待验收: '验收关闭', 已关闭: '已关闭' };

function HazardRow({ hazard, onDetail, onAdvance }: { hazard: Hazard; onDetail: () => void; onAdvance: () => void }) {
  return <article className={hazard.overdue && hazard.status !== '已关闭' ? styles.overdue : ''}>
    <div><code>{hazard.code}</code><strong>{hazard.title}</strong><small><Tag bordered={false}>{hazard.source}</Tag>{hazard.description}</small></div>
    <div><strong>{hazard.areaName}</strong><small>{hazard.category}</small></div>
    <div><Tag color={hazard.level === '重大' ? 'error' : hazard.level === '较大' ? 'orange' : 'default'}>{hazard.level}</Tag>{hazard.recurrenceCount > 0 && <small>复发 {hazard.recurrenceCount} 次</small>}</div>
    <div><strong>{hazard.owner}</strong><small>{hazard.ownerDepartment}</small></div>
    <div><strong>{hazard.deadline}</strong><small className={hazard.overdue ? styles.red : ''}>{hazard.overdue && hazard.status !== '已关闭' ? '已逾期' : `发现 ${hazard.discoveredAt}`}</small></div>
    <div><Tag color={statusColor[hazard.status]}>{hazard.status}</Tag></div>
    <Space size={4}><Button size="small" onClick={onDetail}>详情</Button><Button size="small" type={hazard.status === '待验收' ? 'primary' : 'default'} disabled={hazard.status === '已关闭'} onClick={onAdvance}>{actionText[hazard.status]}</Button></Space>
  </article>;
}

export default function HazardManagement() {
  const { dashboard, loading, loadDashboard, addHazard, addHazardEvidence, startHazard, submitHazard, acceptHazard, toggleHazardSupervision } = useModel('qhse');
  const [status, setStatus] = useState('全部');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [createForm] = Form.useForm<HazardInput>();
  const [evidenceForm] = Form.useForm<Omit<HazardEvidence, 'id' | 'uploadedAt'>>();
  const [acceptForm] = Form.useForm<{ opinion: string }>();

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const hazards = useMemo(() => (dashboard?.hazards ?? []).filter((hazard) => {
    const keyword = query.trim().toLowerCase();
    return (status === '全部' || hazard.status === status)
      && (!keyword || `${hazard.title}${hazard.code}${hazard.areaName}${hazard.owner}`.toLowerCase().includes(keyword));
  }), [dashboard, query, status]);
  const selected = dashboard?.hazards.find((item) => item.id === selectedId);

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="隐患数据暂不可用" /></PageContainer>;

  const open = dashboard.hazards.filter((item) => item.status !== '已关闭').length;
  const overdue = dashboard.hazards.filter((item) => item.overdue && item.status !== '已关闭').length;
  const major = dashboard.hazards.filter((item) => item.level === '重大' && item.status !== '已关闭').length;
  const closed = dashboard.hazards.filter((item) => item.status === '已关闭').length;
  const supervised = dashboard.hazards.filter((item) => item.supervised && item.status !== '已关闭').length;
  const recurring = dashboard.hazards.filter((item) => item.recurrenceCount > 0).length;

  const advance = (hazard: Hazard) => {
    if (hazard.status === '待整改') {
      startHazard(hazard.id);
      message.success(`${hazard.code}：已开始整改`);
      return;
    }
    if (hazard.status === '整改中') {
      if (!hazard.evidence?.length) {
        setSelectedId(hazard.id);
        setEvidenceOpen(true);
        message.warning('至少添加一项整改证据后才能提交验收');
        return;
      }
      submitHazard(hazard.id);
      message.success(`${hazard.code}：已提交验收`);
      return;
    }
    if (hazard.status === '待验收') {
      setSelectedId(hazard.id);
      acceptForm.setFieldsValue({ opinion: '现场复查合格，整改措施有效，同意闭环。' });
      setAcceptOpen(true);
    }
  };

  return (
    <PageContainer title={false} className={styles.page}>
      <header className={styles.heading}><div><span>HAZARD CLOSED-LOOP CONTROL</span><h1>隐患排查治理</h1><p>将现场检查、预警和事件复盘统一转化为责任明确、过程可追踪的整改闭环。</p><Button type="primary" icon={<FileAddOutlined />} onClick={() => { createForm.setFieldsValue({ level: '一般', source: '现场检查', discoveredAt: '2026-07-14', deadline: '2026-07-21', measures: [] }); setCreateOpen(true); }}>上报隐患</Button></div><div className={styles.rate}><CheckCircleFilled /><span>隐患闭环率<strong>{Math.round(closed / dashboard.hazards.length * 100)}%</strong><small>{closed} / {dashboard.hazards.length} 项已关闭</small></span></div></header>

      <section className={styles.metrics}>
        <div><ClockCircleFilled /><span>未闭环<strong>{open}</strong><small>当前整改任务</small></span></div>
        <div className={styles.danger}><WarningFilled /><span>挂牌督办<strong>{supervised}</strong><small>其中重大隐患 {major} 项</small></span></div>
        <div className={overdue ? styles.warning : ''}><ExclamationCircleFilled /><span>逾期未完成<strong>{overdue}</strong><small>已触发超期提醒</small></span></div>
        <div><SyncOutlined /><span>重复隐患<strong>{recurring}</strong><small>需开展根因治理</small></span></div>
        <div><CheckCircleFilled /><span>已关闭<strong>{closed}</strong><small>证据完成归档</small></span></div>
      </section>

      <section className={styles.toolbar}><Segmented value={status} onChange={(value) => setStatus(String(value))} options={['全部', '待整改', '整改中', '待验收', '已关闭']} /><Input allowClear prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索隐患、区域、责任人" /><span>显示 {hazards.length} / {dashboard.hazards.length} 项</span></section>

      <section className={styles.table}>
        <header><span>隐患与来源</span><span>区域 / 类别</span><span>等级</span><span>责任</span><span>期限</span><span>状态</span><span>操作</span></header>
        {hazards.map((hazard) => <HazardRow key={hazard.id} hazard={hazard} onDetail={() => setSelectedId(hazard.id)} onAdvance={() => advance(hazard)} />)}
        {hazards.length === 0 && <Empty description="没有符合条件的隐患" />}
      </section>

      <Modal width={780} title={`${selected?.code ?? ''} 隐患详情`} open={Boolean(selected)} onCancel={() => setSelectedId(undefined)} footer={<Space><Button onClick={() => selected && toggleHazardSupervision(selected.id)}>{selected?.supervised ? '解除挂牌' : '挂牌督办'}</Button>{selected?.status !== '已关闭' && <Button onClick={() => setEvidenceOpen(true)}>添加证据</Button>}<Button type="primary" disabled={!selected || selected.status === '已关闭'} onClick={() => selected && advance(selected)}>{selected ? actionText[selected.status] : '处理'}</Button></Space>}>
        {selected && <><Descriptions size="small" column={2} bordered items={[{ key: 'title', label: '隐患', children: selected.title }, { key: 'level', label: '等级', children: <Tag color={selected.level === '重大' ? 'error' : 'default'}>{selected.level}</Tag> }, { key: 'area', label: '区域', children: selected.areaName }, { key: 'owner', label: '责任', children: `${selected.ownerDepartment} / ${selected.owner}` }, { key: 'deadline', label: '整改期限', children: selected.deadline }, { key: 'supervised', label: '督办', children: selected.supervised ? <Tag color="error">已挂牌</Tag> : '未挂牌' }, { key: 'description', label: '问题描述', children: selected.description, span: 2 }, { key: 'measure', label: '整改措施', children: selected.measures.join(' / ') || '-', span: 2 }]} />
          <div className={styles.detailGrid}><section><h3>整改证据（{selected.evidence?.length ?? 0}）</h3>{selected.evidence?.length ? selected.evidence.map((item) => <article key={item.id}><Tag>{item.category}</Tag><strong>{item.name}</strong><small>{item.uploader} · {item.uploadedAt}</small><p>{item.note}</p></article>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无整改证据" />}</section><section><h3>流转记录</h3><Timeline items={[...(selected.operations ?? [])].reverse().map((item) => ({ children: <><strong>{item.action}</strong><small>{item.operator} · {item.operatedAt}</small><p>{item.detail}</p></> }))} /></section></div></>}
      </Modal>

      <Modal title="上报隐患" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.validateFields().then((values) => { const unit = dashboard.riskUnits.find((item) => item.id === values.riskUnitId); if (!unit) return; addHazard({ ...values, areaId: unit.areaId, areaName: unit.areaName }); setCreateOpen(false); createForm.resetFields(); message.success('隐患已上报并生成整改任务'); })} okText="上报并派发">
        <Form form={createForm} layout="vertical"><Form.Item name="title" label="隐患标题" rules={[{ required: true }]}><Input /></Form.Item><div className={styles.formGrid}><Form.Item name="riskUnitId" label="风险单元" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={dashboard.riskUnits.map((item) => ({ value: item.id, label: `${item.areaName} / ${item.name}` }))} /></Form.Item><Form.Item name="level" label="隐患等级" rules={[{ required: true }]}><Select options={['一般', '较大', '重大'].map((value) => ({ value }))} /></Form.Item><Form.Item name="source" label="排查来源" rules={[{ required: true }]}><Select options={['现场检查', '预警转化', '专项检查', '复盘整改'].map((value) => ({ value }))} /></Form.Item><Form.Item name="category" label="隐患类别" rules={[{ required: true }]}><Input placeholder="设备设施 / 作业环境" /></Form.Item><Form.Item name="ownerDepartment" label="责任部门" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="owner" label="责任人" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="discoveredAt" label="发现日期" rules={[{ required: true }]}><Input placeholder="YYYY-MM-DD" /></Form.Item><Form.Item name="deadline" label="整改期限" rules={[{ required: true }]}><Input placeholder="YYYY-MM-DD" /></Form.Item></div><Form.Item name="description" label="问题描述" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item><Form.Item name="measures" label="整改措施" rules={[{ required: true }]}><Select mode="tags" placeholder="输入措施后回车" /></Form.Item></Form>
      </Modal>

      <Modal title={`添加整改证据 · ${selected?.code ?? ''}`} open={evidenceOpen} onCancel={() => setEvidenceOpen(false)} onOk={() => evidenceForm.validateFields().then((values) => { if (!selected) return; addHazardEvidence(selected.id, values); setEvidenceOpen(false); evidenceForm.resetFields(); message.success('整改证据已归档'); })} okText="归档证据">
        <Form form={evidenceForm} layout="vertical"><Form.Item name="name" label="证据名称" rules={[{ required: true }]}><Input placeholder="例：整改后现场照片-01" /></Form.Item><div className={styles.formGrid}><Form.Item name="category" label="证据阶段" rules={[{ required: true }]}><Select options={['整改前', '整改过程', '整改完成'].map((value) => ({ value }))} /></Form.Item><Form.Item name="uploader" label="上传人" rules={[{ required: true }]}><Input /></Form.Item></div><Form.Item name="note" label="证据说明" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item><p className={styles.formHint}>当前原型记录证据元数据，实际文件待对接对象存储服务。</p></Form>
      </Modal>

      <Modal title={`验收隐患 · ${selected?.code ?? ''}`} open={acceptOpen} onCancel={() => setAcceptOpen(false)} onOk={() => acceptForm.validateFields().then(({ opinion }) => { if (!selected) return; acceptHazard(selected.id, opinion); setAcceptOpen(false); message.success('隐患已验收关闭'); })} okText="验收关闭"><Form form={acceptForm} layout="vertical"><Form.Item name="opinion" label="验收意见" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item></Form></Modal>
    </PageContainer>
  );
}
