import type {
  EmergencyDrillInput,
  EmergencyDrillRecordInput,
  EmergencyPlanDraftInput,
  EmergencyPlanPublishStatus,
  EmergencyPlanTemplate,
  EmergencyPlanVersion,
} from '@/types/qhse';
import {
  compareEmergencyPlanConfigs,
  getEmergencyPlanDisplayConfig,
  getEmergencyPlanExpiryState,
} from '@/utils/emergencyPlanWorkflow';
import {
  ApartmentOutlined,
  AuditOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DiffOutlined,
  EditOutlined,
  FileProtectOutlined,
  FilterOutlined,
  HistoryOutlined,
  NotificationOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useAccess, useModel } from '@umijs/max';
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  message,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

type Category = EmergencyPlanTemplate['category'] | '全部预案';

const categories: Category[] = ['全部预案', '综合应急预案', '专项应急预案', '现场处置方案', '岗位应急处置卡'];

const levelColor: Record<EmergencyPlanTemplate['responseLevel'], string> = {
  'IV级': 'default', 'III级': 'blue', 'II级': 'orange', 'I级': 'red',
};
const publishColor: Record<EmergencyPlanPublishStatus, string> = { 草稿: 'gold', 待评审: 'purple', 已发布: 'success' };

function getPlanStatus(plan: EmergencyPlanTemplate) {
  return plan.publishStatus === '已发布' ? plan.status : plan.publishStatus;
}

export default function EmergencyPlans() {
  const access = useAccess();
  const {
    emergencyPlans: planRecords, emergencyPlanLoading, loadEmergencyPlans, saveEmergencyPlan, submitEmergencyPlan,
    approveEmergencyPlan, rollbackEmergencyPlanVersion, addEmergencyDrill,
    startEmergencyDrill, recordEmergencyDrill,
  } = useModel('qhse');
  const [category, setCategory] = useState<Category>('全部预案');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('tpl-001');
  const [status, setStatus] = useState('全部状态');
  const [editingId, setEditingId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [diffVersion, setDiffVersion] = useState<EmergencyPlanVersion>();
  const [drillEditorOpen, setDrillEditorOpen] = useState(false);
  const [recordingDrillId, setRecordingDrillId] = useState<string>();
  const [form] = Form.useForm<EmergencyPlanDraftInput>();
  const [drillForm] = Form.useForm<EmergencyDrillInput>();
  const [recordForm] = Form.useForm<EmergencyDrillRecordInput>();

  useEffect(() => { void loadEmergencyPlans(); }, [loadEmergencyPlans]);

  const plans = useMemo(() => planRecords.filter((plan) => {
    const display = getEmergencyPlanDisplayConfig(plan);
    const categoryMatch = category === '全部预案' || display.category === category;
    const statusMatch = status === '全部状态' || getPlanStatus(plan) === status;
    const keyword = query.trim().toLowerCase();
    const queryMatch = !keyword || `${display.name}${plan.code}${display.eventType}${display.applicableArea}`.toLowerCase().includes(keyword);
    return categoryMatch && statusMatch && queryMatch;
  }), [category, planRecords, query, status]);

  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0] ?? planRecords[0];
  const display = selected ? getEmergencyPlanDisplayConfig(selected) : undefined;

  if (emergencyPlanLoading && !planRecords.length) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!selected || !display) return <PageContainer><Empty description="预案数据暂不可用" /></PageContainer>;

  const activeCount = planRecords.filter((plan) => plan.status === '生效中').length;
  const reviewCount = planRecords.filter((plan) => plan.publishStatus === '待评审').length;
  const expiringCount = planRecords.filter((plan) => getEmergencyPlanExpiryState(plan, '2026-07-13') === '即将到期').length;
  const plannedDrillCount = planRecords.flatMap((plan) => plan.drills ?? []).filter((drill) => drill.status === '计划中').length;
  const openEditor = (plan?: EmergencyPlanTemplate) => {
    const config = plan ? getEmergencyPlanDisplayConfig(plan) : {
      name: '', category: '现场处置方案' as const, eventType: '', applicableArea: '', medium: '',
      responseLevel: 'IV级' as const, triggerRule: '', notificationTargets: [], steps: [], resources: [],
      effectiveDate: '2026-07-13', expiryDate: '2027-07-12', ownerDepartment: '',
    };
    setEditingId(plan?.id);
    form.setFieldsValue({ code: plan?.code ?? '', ...config });
    setEditorOpen(true);
  };
  const handleSave = async () => {
    const values = await form.validateFields();
    if (values.expiryDate <= values.effectiveDate) {
      form.setFields([{ name: 'expiryDate', errors: ['到期日期必须晚于生效日期'] }]);
      return;
    }
    const saved = await saveEmergencyPlan(editingId, { ...values, code: values.code.trim().toUpperCase() });
    setSelectedId(saved?.id ?? editingId ?? '');
    setCategory('全部预案');
    setStatus('全部状态');
    setEditorOpen(false);
    message.success(editingId ? '预案修改已保存为草稿' : '新预案草稿已创建');
  };
  const handleAddDrill = async () => {
    const values = await drillForm.validateFields();
    await addEmergencyDrill(selected.id, values);
    setDrillEditorOpen(false);
    drillForm.resetFields();
    message.success('演练计划已创建');
  };
  const handleRecordDrill = async () => {
    const values = await recordForm.validateFields();
    if (!recordingDrillId) return;
    await recordEmergencyDrill(selected.id, recordingDrillId, values);
    setRecordingDrillId(undefined);
    recordForm.resetFields();
    message.success('演练复盘记录已归档');
  };
  const expiryState = getEmergencyPlanExpiryState(selected, '2026-07-13');
  const nextReviewStep = selected.reviewSteps?.find((step) => step.status === '待评审');
  const diffItems = diffVersion ? compareEmergencyPlanConfigs(diffVersion, display) : [];

  return (
    <PageContainer title={false} className={styles.page} extra={<Button type="primary" icon={<FileProtectOutlined />} disabled={!access.canEditPlan} onClick={() => openEditor()}>新建预案</Button>}>
      <header className={styles.heading}>
        <div><span>EMERGENCY PLAN LIBRARY</span><h1>应急预案库</h1><p>统一维护预案触发条件、处置步骤、通知对象、资源清单与版本状态。</p></div>
        <div className={styles.summary}>
          <div><strong>{planRecords.length}</strong><span>预案总数</span></div>
          <div><strong>{activeCount}</strong><span>生效中</span></div>
          <div className={styles.review}><strong>{reviewCount}</strong><span>待评审</span></div>
          <div className={styles.expiring}><strong>{expiringCount}</strong><span>即将到期</span></div>
          <div className={styles.drill}><strong>{plannedDrillCount}</strong><span>演练计划</span></div>
        </div>
      </header>

      <section className={styles.toolbar}>
        <Input prefix={<SearchOutlined />} placeholder="搜索预案名称、编号、区域或事件类型" value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
        <Segmented value={status} onChange={(value) => setStatus(String(value))} options={['全部状态', '生效中', '草稿', '待评审', '已停用']} />
        <span><FilterOutlined /> 当前显示 {plans.length} 套</span>
      </section>

      <main className={styles.libraryGrid}>
        <nav className={styles.categoryRail} aria-label="预案分类">
          <span>PLAN CLASS</span>
          {categories.map((item) => {
            const count = item === '全部预案' ? planRecords.length : planRecords.filter((plan) => getEmergencyPlanDisplayConfig(plan).category === item).length;
            return <button key={item} type="button" className={category === item ? styles.active : ''} onClick={() => setCategory(item)}><i>{item === '全部预案' ? <ApartmentOutlined /> : <FileProtectOutlined />}</i><strong>{item}</strong><em>{count}</em></button>;
          })}
          <div className={styles.coverage}><SafetyCertificateOutlined /><strong>12 类事故场景</strong><span>覆盖泄漏、火灾、环保、公用工程等风险</span></div>
        </nav>

        <section className={styles.catalog}>
          <header><span>PLAN CATALOG</span><h2>预案目录</h2></header>
          <div className={styles.planList}>
            {plans.map((plan) => {
              const planDisplay = getEmergencyPlanDisplayConfig(plan);
              const planExpiry = getEmergencyPlanExpiryState(plan, '2026-07-13');
              const planStatus = getPlanStatus(plan);
              return <button key={plan.id} type="button" className={`${styles.planCard} ${selected.id === plan.id ? styles.selected : ''}`} onClick={() => setSelectedId(plan.id)}>
                <div className={styles.planTop}><Tag color={levelColor[planDisplay.responseLevel]}>{planDisplay.responseLevel}</Tag><em className={planStatus === '待评审' || planStatus === '草稿' ? styles.pending : ''}>{planStatus}</em></div>
                <strong>{planDisplay.name}</strong><code>{plan.code}</code>
                <div className={styles.planMeta}><span>{planDisplay.category}</span><span>{planDisplay.applicableArea}</span></div>
                <footer><span><ClockCircleOutlined /> {planDisplay.effectiveDate}</span><b>{plan.version}</b>{planExpiry === '即将到期' && <i>即将到期</i>}</footer>
              </button>;
            })}
            {plans.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的预案" />}
          </div>
        </section>

        <aside className={styles.planDetail}>
          <header><div><span>PLAN DOSSIER</span><h2>{display.name}</h2></div><Tag color={publishColor[selected.publishStatus]}>{getPlanStatus(selected)}</Tag></header>
          <div className={styles.identity}><code>{selected.code}</code><b>{selected.version}</b><span>{display.ownerDepartment}</span></div>
          <section className={styles.workflow}>
            <div><span className={selected.publishStatus === '草稿' ? styles.workflowActive : ''}>1 草稿</span><i /><span className={selected.publishStatus === '待评审' ? styles.workflowActive : ''}>2 双人会签</span><i /><span className={selected.publishStatus === '已发布' ? styles.workflowActive : ''}>3 已发布</span></div>
            <p>{selected.draft ? `当前展示未发布草稿；应急匹配仍使用 ${selected.version}。` : `${selected.version} 已生效，编辑后将生成独立草稿。`}</p>
            {selected.reviewSteps && <div className={styles.reviewSteps}>{selected.reviewSteps.map((step) => <span key={step.role} className={step.status === '已通过' ? styles.reviewed : ''}><AuditOutlined /> {step.role} · {step.reviewer} · {step.status}</span>)}</div>}
            <Space wrap><Button size="small" icon={<EditOutlined />} disabled={!access.canEditPlan} onClick={() => openEditor(selected)}>编辑</Button>{selected.publishStatus === '草稿' && <Button size="small" type="primary" icon={<SendOutlined />} disabled={!access.canSubmitPlan} onClick={() => { void submitEmergencyPlan(selected.id).then(() => message.success('预案已提交双人会签')); }}>提交会签</Button>}{selected.publishStatus === '待评审' && nextReviewStep && <Button size="small" type="primary" icon={<CheckCircleFilled />} disabled={!access.canApprovePlan} onClick={() => { const isFinal = selected.reviewSteps?.filter((step) => step.status === '待评审').length === 1; void approveEmergencyPlan(selected.id).then(() => message.success(isFinal ? '双人会签完成，预案已发布' : `${nextReviewStep.role}已通过，等待下一会签人`)); }}>{nextReviewStep.role}</Button>}<Button size="small" icon={<HistoryOutlined />} disabled={selected.versions.length === 0} onClick={() => setVersionsOpen(true)}>版本历史</Button></Space>
          </section>
          <section className={styles.expiryNotice}><CalendarOutlined /><span>有效期<strong>{display.effectiveDate} 至 {display.expiryDate}</strong></span><Tag color={expiryState === '已过期' ? 'error' : expiryState === '即将到期' ? 'warning' : 'success'}>{expiryState}</Tag></section>
          <section className={styles.ruleBox}><span>MATCH RULE / 触发规则</span><p>{display.triggerRule}</p><div><Tag>{display.eventType}</Tag><Tag>{display.medium}</Tag><Tag color={levelColor[display.responseLevel]}>{display.responseLevel}响应</Tag></div></section>

          <section className={styles.detailSection}><h3><RocketOutlined /> 关键处置步骤</h3><ol>{display.steps.map((step) => <li key={step}><i /><span>{step}</span></li>)}</ol></section>
          <section className={styles.detailSection}><h3><NotificationOutlined /> 通知对象</h3><div className={styles.chips}>{display.notificationTargets.map((target) => <span key={target}><TeamOutlined /> {target}</span>)}</div></section>
          <section className={styles.detailSection}><h3><ToolOutlined /> 应急资源</h3><div className={styles.chips}>{display.resources.map((resource) => <span key={resource}>{resource}</span>)}</div></section>
          <section className={`${styles.detailSection} ${styles.drillSection}`}>
            <div className={styles.sectionHeading}><h3><CalendarOutlined /> 演练计划与记录</h3><Button size="small" icon={<PlusOutlined />} disabled={!access.canManageDrill} onClick={() => { drillForm.resetFields(); setDrillEditorOpen(true); }}>安排演练</Button></div>
            <div className={styles.drillList}>{(selected.drills ?? []).map((drill) => <article key={drill.id} className={styles.drillCard}>
              <div><Tag color={drill.status === '已完成' ? 'success' : drill.status === '待复盘' ? 'warning' : 'processing'}>{drill.status}</Tag><strong>{drill.title}</strong><span>{drill.type} · {drill.plannedAt.replace('T', ' ')} · {drill.location}</span><small>负责人 {drill.leader} · {drill.participants.join('、')}</small>{drill.status === '已完成' && <p><b>{drill.score} 分</b> {drill.summary}{drill.issues?.length ? `；问题：${drill.issues.join('、')}` : ''}</p>}</div>
              {drill.status === '计划中' && <Button size="small" icon={<PlayCircleOutlined />} disabled={!access.canManageDrill} onClick={() => { void startEmergencyDrill(selected.id, drill.id).then(() => message.success('演练已开始，结束后请填写复盘记录')); }}>开始</Button>}
              {drill.status === '待复盘' && <Button size="small" type="primary" onClick={() => { recordForm.resetFields(); setRecordingDrillId(drill.id); }}>填写复盘</Button>}
            </article>)}{(selected.drills ?? []).length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未安排演练" />}</div>
          </section>

          <footer className={styles.detailFooter}>
            <div><CheckCircleFilled /><span>生效日期<strong>{display.effectiveDate}</strong></span></div>
            <Button type="primary" disabled={selected.status !== '生效中'} onClick={() => history.push('/emergency')}>进入应急指挥台</Button>
          </footer>
        </aside>
      </main>
      <Modal title={editingId ? '编辑预案草稿' : '新建应急预案'} open={editorOpen} okText="保存草稿" cancelText="取消" width={780} onOk={() => void handleSave()} onCancel={() => setEditorOpen(false)}>
        <Form form={form} layout="vertical" className={styles.planForm}>
          <Form.Item name="code" label="预案编码" rules={[{ required: true, message: '请输入预案编码' }, { pattern: /^[A-Za-z][A-Za-z0-9-]{2,39}$/, message: '使用字母、数字或连字符，长度 3-40 位' }, { validator: (_, value) => planRecords.some((plan) => plan.code === String(value).trim().toUpperCase() && plan.id !== editingId) ? Promise.reject(new Error('预案编码已存在')) : Promise.resolve() }]}><Input disabled={Boolean(editingId)} placeholder="例如 QHSE-FCC-LEAK-02" /></Form.Item>
          <Form.Item name="name" label="预案名称" rules={[{ required: true, message: '请输入预案名称' }]}><Input /></Form.Item>
          <Form.Item name="category" label="预案类别" rules={[{ required: true }]}><Select options={categories.slice(1).map((value) => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="responseLevel" label="响应等级" rules={[{ required: true }]}><Select options={['IV级', 'III级', 'II级', 'I级'].map((value) => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="eventType" label="事件类型" rules={[{ required: true, message: '请输入事件类型' }]}><Input /></Form.Item>
          <Form.Item name="medium" label="涉及介质" rules={[{ required: true, message: '请输入涉及介质' }]}><Input /></Form.Item>
          <Form.Item name="applicableArea" label="适用区域" rules={[{ required: true, message: '请输入适用区域' }]}><Input /></Form.Item>
          <Form.Item name="ownerDepartment" label="责任部门" rules={[{ required: true, message: '请输入责任部门' }]}><Input /></Form.Item>
          <Form.Item name="effectiveDate" label="生效日期" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="expiryDate" label="到期日期" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="triggerRule" label="触发规则" rules={[{ required: true, message: '请输入触发规则' }]}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="notificationTargets" label="通知对象" rules={[{ required: true, message: '至少配置一个通知对象' }]}><Select mode="tags" tokenSeparators={[',']} placeholder="输入对象后回车" /></Form.Item>
          <Form.Item name="steps" label="处置步骤" rules={[{ required: true, message: '至少配置一个处置步骤' }]}><Select mode="tags" tokenSeparators={[',']} placeholder="按顺序输入步骤并回车" /></Form.Item>
          <Form.Item name="resources" label="资源清单" rules={[{ required: true, message: '至少配置一项资源' }]}><Select mode="tags" tokenSeparators={[',']} placeholder="输入资源后回车" /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`${selected.code} 版本历史`} open={versionsOpen} footer={null} width={760} onCancel={() => setVersionsOpen(false)}>
        <section className={styles.versionList}>{[...selected.versions].reverse().map((version) => <article key={version.version}><div><strong>{version.version}</strong><span>{version.publishedAt}</span><p>{version.triggerRule}</p><small>{version.publisher}</small></div><Space><Button size="small" icon={<DiffOutlined />} onClick={() => setDiffVersion(version)}>与当前对比</Button><Popconfirm title={`回滚至 ${version.version}？`} description="历史预案将生成新草稿，当前生效版本不会立即改变。" okText="生成草稿" cancelText="取消" onConfirm={() => { rollbackEmergencyPlanVersion(selected.id, version.version); setVersionsOpen(false); message.success(`${version.version} 已恢复为预案草稿`); }}><Button size="small" icon={<RollbackOutlined />}>回滚为草稿</Button></Popconfirm></Space></article>)}</section>
      </Modal>
      <Modal title={`${diffVersion?.version ?? ''} 与当前内容差异`} open={Boolean(diffVersion)} footer={null} width={760} onCancel={() => setDiffVersion(undefined)}>
        <section className={styles.diffList}>{diffItems.map((item) => <article key={item.key}><strong>{item.label}</strong><div><span>历史版本</span><p>{item.before || '—'}</p></div><div><span>当前内容</span><p>{item.after || '—'}</p></div></article>)}{diffItems.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该版本与当前内容一致" />}</section>
      </Modal>
      <Modal title="安排应急演练" open={drillEditorOpen} okText="创建计划" cancelText="取消" onOk={() => void handleAddDrill()} onCancel={() => setDrillEditorOpen(false)}>
        <Form form={drillForm} layout="vertical" className={styles.drillForm}>
          <Form.Item name="title" label="演练名称" rules={[{ required: true, message: '请输入演练名称' }]}><Input /></Form.Item>
          <Form.Item name="type" label="演练类型" rules={[{ required: true }]}><Select options={['桌面推演', '专项演练', '综合演练'].map((value) => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="plannedAt" label="计划时间" rules={[{ required: true, message: '请选择计划时间' }]}><Input type="datetime-local" /></Form.Item>
          <Form.Item name="location" label="演练地点" rules={[{ required: true, message: '请输入演练地点' }]}><Input /></Form.Item>
          <Form.Item name="leader" label="负责人" rules={[{ required: true, message: '请输入负责人' }]}><Input /></Form.Item>
          <Form.Item name="participants" label="参与单位" rules={[{ required: true, message: '至少填写一个参与单位' }]}><Select mode="tags" tokenSeparators={[',']} placeholder="输入后回车" /></Form.Item>
        </Form>
      </Modal>
      <Modal title="填写演练复盘" open={Boolean(recordingDrillId)} okText="归档记录" cancelText="取消" onOk={() => void handleRecordDrill()} onCancel={() => setRecordingDrillId(undefined)}>
        <Form form={recordForm} layout="vertical">
          <Form.Item name="score" label="演练评分" rules={[{ required: true, message: '请输入 0-100 分' }]}><InputNumber min={0} max={100} precision={0} addonAfter="分" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="summary" label="复盘结论" rules={[{ required: true, whitespace: true, message: '请输入复盘结论' }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="issues" label="发现问题"><Select mode="tags" tokenSeparators={[',']} placeholder="输入问题后回车，可留空" /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
