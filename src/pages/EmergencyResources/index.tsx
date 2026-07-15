import type {
  EmergencyResource,
  EmergencyResourceBatchInput,
  EmergencyResourceDispatchInput,
  EmergencyResourceInput,
  EmergencyResourceInspectionInput,
} from '@/types/qhse';
import {
  getActiveEmergencyResourceDispatch,
  getDispatchableEmergencyResourceQuantity,
  getEmergencyResourceBatchStatus,
} from '@/utils/emergencyResourceWorkflow';
import {
  CarFilled,
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FireFilled,
  HistoryOutlined,
  InboxOutlined,
  MedicineBoxFilled,
  PhoneFilled,
  SafetyCertificateFilled,
  SearchOutlined,
  SendOutlined,
  ToolFilled,
  WarningFilled,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  message,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

type ResourceType = EmergencyResource['type'] | '全部资源';
type DispatchFormValues = Omit<EmergencyResourceDispatchInput, 'id' | 'dispatchedAt'>;
type InspectionFormValues = Omit<EmergencyResourceInspectionInput, 'id' | 'inspectedAt'>;

const typeIcon: Record<EmergencyResource['type'], React.ReactNode> = {
  消防: <FireFilled />, 气防: <SafetyCertificateFilled />, 医疗: <MedicineBoxFilled />, 物资: <ToolFilled />,
};

const inspectionColor: Record<EmergencyResource['inspectionStatus'], string> = {
  检查合格: 'success', 即将到期: 'warning', 需要维护: 'error',
};

const dateRule = { pattern: /^\d{4}-\d{2}-\d{2}$/, message: '请输入 YYYY-MM-DD 格式日期' };

function getCurrentDate() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value) => String(value).padStart(2, '0'))
    .join('-');
}

export default function EmergencyResources() {
  const {
    dashboard,
    loading,
    loadDashboard,
    addEmergencyResource,
    addEmergencyResourceBatch,
    dispatchEmergencyResource,
    confirmEmergencyResourceArrival,
    returnEmergencyResource,
    inspectEmergencyResource,
  } = useModel('qhse');
  const [type, setType] = useState<ResourceType>('全部资源');
  const [status, setStatus] = useState('全部状态');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [dispatchResourceId, setDispatchResourceId] = useState<string>();
  const [inspectionResourceId, setInspectionResourceId] = useState<string>();
  const [batchResourceId, setBatchResourceId] = useState<string>();
  const [historyResourceId, setHistoryResourceId] = useState<string>();
  const [resourceForm] = Form.useForm<EmergencyResourceInput>();
  const [batchForm] = Form.useForm<EmergencyResourceBatchInput>();
  const [dispatchForm] = Form.useForm<DispatchFormValues>();
  const [inspectionForm] = Form.useForm<InspectionFormValues>();

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const resources = useMemo(() => (dashboard?.emergencyResources ?? []).filter((resource) => {
    const keyword = query.trim().toLowerCase();
    return (type === '全部资源' || resource.type === type)
      && (status === '全部状态' || resource.status === status)
      && (!keyword || `${resource.name}${resource.code}${resource.location}${resource.owner}`.toLowerCase().includes(keyword));
  }), [dashboard, query, status, type]);
  const today = useMemo(getCurrentDate, []);

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="应急资源数据暂不可用" /></PageContainer>;

  const allResources = dashboard.emergencyResources;
  const dispatchResource = allResources.find((item) => item.id === dispatchResourceId);
  const batchResource = allResources.find((item) => item.id === batchResourceId);
  const inspectionResource = allResources.find((item) => item.id === inspectionResourceId);
  const historyResource = allResources.find((item) => item.id === historyResourceId);
  const arrived = allResources.filter((item) => item.status === '已到位').length;
  const dispatching = allResources.filter((item) => item.status === '调度中').length;
  const occupied = allResources.filter((item) => item.availableQuantity < item.totalQuantity).length;
  const ready = allResources.filter((item) => getDispatchableEmergencyResourceQuantity(item, today) > 0 && item.inspectionStatus !== '需要维护').length;
  const readyRate = allResources.length ? Math.round((ready / allResources.length) * 100) : 0;
  const maintenance = allResources.filter((item) => item.inspectionStatus !== '检查合格').length;
  const expiryAttention = allResources.flatMap((item) => item.batches ?? [])
    .filter((batch) => getEmergencyResourceBatchStatus(batch, today) !== '正常').length;

  const openDispatch = (resource: EmergencyResource) => {
    setDispatchResourceId(resource.id);
    dispatchForm.setFieldsValue({
      eventName: dashboard.alarms.find((item) => item.id === dashboard.emergencyPlan.eventId)?.title ?? dashboard.emergencyPlan.name,
      destination: dashboard.emergencyPlan.assemblyPoint,
      quantity: 1,
      operator: '陈涛 / 生产调度',
    });
  };

  const openInspection = (resource: EmergencyResource) => {
    setInspectionResourceId(resource.id);
    inspectionForm.setFieldsValue({
      inspector: resource.owner,
      result: '检查合格',
      nextInspection: resource.nextInspection,
      note: '设备外观、功能和附件检查完成',
    });
  };

  const openBatch = (resource: EmergencyResource) => {
    setBatchResourceId(resource.id);
    batchForm.resetFields();
    batchForm.setFieldsValue({ quantity: 1, receivedAt: today });
  };

  const submitResource = async () => {
    const values = await resourceForm.validateFields();
    if (allResources.some((item) => item.code.toLowerCase() === values.code.trim().toLowerCase())) {
      resourceForm.setFields([{ name: 'code', errors: ['资源编号已存在'] }]);
      return;
    }
    addEmergencyResource({ ...values, code: values.code.trim() });
    setCreateOpen(false);
    resourceForm.resetFields();
    message.success('资源已登记入库，请按期完成首次检查');
  };

  const submitDispatch = async () => {
    if (!dispatchResource) return;
    const values = await dispatchForm.validateFields();
    dispatchEmergencyResource(dispatchResource.id, values);
    setDispatchResourceId(undefined);
    dispatchForm.resetFields();
    message.success(`${dispatchResource.name}已调拨，占用 ${values.quantity} ${dispatchResource.unit}`);
  };

  const submitBatch = async () => {
    if (!batchResource) return;
    const values = await batchForm.validateFields();
    if (batchResource.batches?.some((batch) => batch.batchNo.toLowerCase() === values.batchNo.trim().toLowerCase())) {
      batchForm.setFields([{ name: 'batchNo', errors: ['批号已存在'] }]);
      return;
    }
    addEmergencyResourceBatch(batchResource.id, { ...values, batchNo: values.batchNo.trim() });
    batchForm.resetFields();
    message.success(`${batchResource.name}已新增批次并更新库存`);
  };

  const submitInspection = async () => {
    if (!inspectionResource) return;
    const values = await inspectionForm.validateFields();
    inspectEmergencyResource(inspectionResource.id, values);
    setInspectionResourceId(undefined);
    inspectionForm.resetFields();
    message.success(`${inspectionResource.name}巡检记录已更新`);
  };

  return (
    <PageContainer title={false} className={styles.page} extra={<Button type="primary" icon={<CarFilled />} onClick={() => { resourceForm.resetFields(); setCreateOpen(true); }}>新增资源</Button>}>
      <header className={styles.heading}>
        <div><span>EMERGENCY RESOURCE CONTROL</span><h1>应急资源管理</h1><p>统一维护批次、有效期、库存、检查状态、调拨占用、到位确认和归还记录。</p></div>
        <div className={styles.readiness}><i /><span>综合战备率<strong>{readyRate}%</strong><small>{ready} / {allResources.length} 项可立即调拨</small></span></div>
      </header>

      <section className={styles.metrics} aria-label="资源战备指标">
        <div><span>资源总数</span><strong>{allResources.length}<em>项</em></strong><small>覆盖 4 个专业类别</small></div>
        <div><span>库存占用</span><strong>{occupied}<em>项</em></strong><small><SendOutlined /> 调度中 {dispatching} · 已到位 {arrived}</small></div>
        <div><span>可立即调拨</span><strong>{ready}<em>项</em></strong><small><CheckCircleFilled /> 有库存且检查正常</small></div>
        <div className={maintenance || expiryAttention ? styles.warningMetric : ''}><span>有效期 / 检查关注</span><strong>{expiryAttention + maintenance}<em>项次</em></strong><small><WarningFilled /> {expiryAttention} 个批次到期关注 · {maintenance} 项检查关注</small></div>
      </section>

      <section className={styles.toolbar}>
        <Input prefix={<SearchOutlined />} placeholder="搜索资源、编号、位置或责任人" value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
        <Segmented value={status} onChange={(value) => setStatus(String(value))} options={['全部状态', '待命', '调度中', '已到位']} />
        <span>显示 {resources.length} / {allResources.length} 项</span>
      </section>

      <main className={styles.resourceLayout}>
        <nav className={styles.typeRail} aria-label="资源分类">
          <span>RESOURCE CLASS</span>
          {(['全部资源', '消防', '气防', '医疗', '物资'] as ResourceType[]).map((item) => {
            const count = item === '全部资源' ? allResources.length : allResources.filter((resource) => resource.type === item).length;
            return <button key={item} type="button" className={type === item ? styles.active : ''} onClick={() => setType(item)}><i>{item === '全部资源' ? <CarFilled /> : typeIcon[item]}</i><strong>{item}</strong><em>{count}</em></button>;
          })}
          <div className={styles.hotline}><PhoneFilled /><span>应急调度热线<strong>6000</strong><small>24 小时值守</small></span></div>
        </nav>

        <section className={styles.catalog}>
          <header><div><span>RESOURCE INVENTORY</span><h2>资源台账与调度</h2></div><Tag>{resources.length} 项资源</Tag></header>
          <div className={styles.resourceGrid}>{resources.map((resource) => {
            const activeDispatch = getActiveEmergencyResourceDispatch(resource);
            const dispatchableQuantity = getDispatchableEmergencyResourceQuantity(resource, today);
            const batchStatuses = (resource.batches ?? []).map((batch) => getEmergencyResourceBatchStatus(batch, today));
            const expiredBatches = batchStatuses.filter((item) => item === '已过期').length;
            const expiringBatches = batchStatuses.filter((item) => item === '即将到期').length;
            return (
              <article key={resource.id} className={`${styles.resourceCard} ${styles[resource.status]}`}>
                <header><i>{typeIcon[resource.type]}</i><div><code>{resource.code}</code><h3>{resource.name}</h3></div><em>{resource.status}</em></header>
                <div className={styles.quantity}>{dispatchableQuantity}<span>/ {resource.totalQuantity} {resource.unit} 有效可调</span></div>
                <dl>
                  <div><dt><EnvironmentOutlined /> 存放位置</dt><dd>{resource.location}</dd></div>
                  <div><dt><ClockCircleOutlined /> 预计到场</dt><dd>{resource.eta}</dd></div>
                  <div><dt><PhoneFilled /> 责任人</dt><dd>{resource.owner} · {resource.contact}</dd></div>
                  <div><dt><CheckCircleFilled /> 下次检查</dt><dd>{resource.nextInspection}</dd></div>
                  <div><dt><InboxOutlined /> 批次状态</dt><dd>{resource.batches?.length ? `${resource.batches.length} 批 · 临期 ${expiringBatches} · 过期 ${expiredBatches}` : '历史库存（未分批）'}</dd></div>
                </dl>
                <footer>
                  <div><Tag color={inspectionColor[resource.inspectionStatus]}>{resource.inspectionStatus}</Tag><small>上次 {resource.lastInspection}</small></div>
                  <Space size={4} wrap>
                    <Button size="small" icon={<HistoryOutlined />} onClick={() => setHistoryResourceId(resource.id)}>记录</Button>
                    <Button size="small" icon={<InboxOutlined />} onClick={() => openBatch(resource)}>批次</Button>
                    <Button size="small" onClick={() => openInspection(resource)}>巡检</Button>
                    {!activeDispatch && <Button size="small" type="primary" disabled={!dispatchableQuantity || resource.inspectionStatus === '需要维护'} onClick={() => openDispatch(resource)}>调拨</Button>}
                    {activeDispatch?.status === '调度中' && <Popconfirm title="确认资源已到达事件点？" okText="确认到位" cancelText="取消" onConfirm={() => { confirmEmergencyResourceArrival(resource.id, activeDispatch.id); message.success(`${resource.name}已确认到位`); }}><Button size="small" type="primary">确认到位</Button></Popconfirm>}
                    {activeDispatch?.status === '已到位' && <Popconfirm title="确认资源已经归还并恢复库存？" okText="确认归还" cancelText="取消" onConfirm={() => { returnEmergencyResource(resource.id, activeDispatch.id); message.success(`${resource.name}已归还入库`); }}><Button size="small" type="primary">归还</Button></Popconfirm>}
                  </Space>
                </footer>
              </article>
            );
          })}{resources.length === 0 && <Empty description="没有符合条件的应急资源" />}</div>
        </section>

        <aside className={styles.dispatchBoard}>
          <header><span>DISPATCH PIPELINE</span><h2>当前调度态势</h2></header>
          <div className={styles.pipeline}>
            {(['已到位', '调度中', '待命'] as EmergencyResource['status'][]).map((item) => {
              const list = allResources.filter((resource) => resource.status === item);
              return <section key={item}><div><i className={styles[item]} /><strong>{item}</strong><em>{list.length}</em></div>{list.map((resource) => <p key={resource.id}><span>{resource.name}</span><small>{resource.availableQuantity}/{resource.totalQuantity} {resource.unit}</small></p>)}</section>;
            })}
          </div>
          <div className={styles.coverage}><span>资源战备覆盖</span><strong>{readyRate}%</strong><Progress percent={readyRate} showInfo={false} strokeColor="#1a7791" /><small>按有未过期库存且无需维护的资源计算</small></div>
          <div className={styles.maintenance}><WarningFilled /><span>维护提示<strong>{maintenance} 项资源需要关注</strong><small>{allResources.filter((item) => item.inspectionStatus !== '检查合格').map((item) => item.name).join('、') || '当前无待维护资源'}</small></span></div>
        </aside>
      </main>

      <Modal title="新增应急资源" open={createOpen} okText="登记入库" cancelText="取消" onOk={() => void submitResource()} onCancel={() => setCreateOpen(false)} width={720} destroyOnClose>
        <Form form={resourceForm} layout="vertical" className={styles.formGrid} initialValues={{ type: '物资', totalQuantity: 1, unit: '套', eta: '5 分钟', receivedAt: today }}>
          <Form.Item name="code" label="资源编号" rules={[{ required: true, message: '请输入资源编号' }]}><Input placeholder="例如 LEAK-KIT-02" /></Form.Item>
          <Form.Item name="name" label="资源名称" rules={[{ required: true, message: '请输入资源名称' }]}><Input /></Form.Item>
          <Form.Item name="type" label="专业类别" rules={[{ required: true }]}><Select options={['消防', '气防', '医疗', '物资'].map((value) => ({ value }))} /></Form.Item>
          <Form.Item name="totalQuantity" label="入库数量" rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="unit" label="计量单位" rules={[{ required: true, message: '请输入计量单位' }]}><Input placeholder="套、台、辆、批" /></Form.Item>
          <Form.Item name="location" label="存放位置" rules={[{ required: true, message: '请输入存放位置' }]}><Input /></Form.Item>
          <Form.Item name="eta" label="预计到场" rules={[{ required: true, message: '请输入预计到场时间' }]}><Input /></Form.Item>
          <Form.Item name="owner" label="责任人" rules={[{ required: true, message: '请输入责任人' }]}><Input /></Form.Item>
          <Form.Item name="contact" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}><Input /></Form.Item>
          <Form.Item name="nextInspection" label="首次检查期限" rules={[{ required: true, message: '请输入检查期限' }, dateRule]}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name="batchNo" label="首批次号" rules={[{ required: true, message: '请输入批次号' }]}><Input placeholder="例如 202607-A01" /></Form.Item>
          <Form.Item name="receivedAt" label="入库日期" rules={[{ required: true, message: '请输入入库日期' }, dateRule]}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name="expiryDate" label="有效期至" rules={[{ required: true, message: '请输入有效期' }, dateRule]}><Input placeholder="YYYY-MM-DD" /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`批次与有效期${batchResource ? ` · ${batchResource.name}` : ''}`} open={Boolean(batchResource)} okText="新增批次" cancelText="关闭" onOk={() => void submitBatch()} onCancel={() => setBatchResourceId(undefined)} width={720} destroyOnClose>
        {batchResource && <div className={styles.batchPanel}>
          <section>
            <h3>现有批次</h3>
            {batchResource.batches?.length ? [...batchResource.batches].sort((left, right) => left.expiryDate.localeCompare(right.expiryDate)).map((batch) => {
              const batchStatus = getEmergencyResourceBatchStatus(batch, today);
              return <article key={batch.id}><Tag color={batchStatus === '正常' ? 'success' : batchStatus === '即将到期' ? 'warning' : 'error'}>{batchStatus}</Tag><div><strong>{batch.batchNo}</strong><p>可用 {batch.availableQuantity} / {batch.quantity} {batchResource.unit}</p><small>入库 {batch.receivedAt} · 有效期至 {batch.expiryDate}</small></div></article>;
            }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="历史库存尚未建立批次，可在下方新增" />}
          </section>
          <Form form={batchForm} layout="vertical" className={styles.formGrid}>
            <Form.Item name="batchNo" label="批次号" rules={[{ required: true, message: '请输入批次号' }]}><Input /></Form.Item>
            <Form.Item name="quantity" label={`入库数量（${batchResource.unit}）`} rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="receivedAt" label="入库日期" rules={[{ required: true, message: '请输入入库日期' }, dateRule]}><Input placeholder="YYYY-MM-DD" /></Form.Item>
            <Form.Item name="expiryDate" label="有效期至" rules={[{ required: true, message: '请输入有效期' }, dateRule]}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          </Form>
        </div>}
      </Modal>

      <Modal title={`调拨资源${dispatchResource ? ` · ${dispatchResource.name}` : ''}`} open={Boolean(dispatchResource)} okText="确认调拨" cancelText="取消" onOk={() => void submitDispatch()} onCancel={() => setDispatchResourceId(undefined)} destroyOnClose>
        <Form form={dispatchForm} layout="vertical">
          <Form.Item name="eventName" label="关联事件" rules={[{ required: true, message: '请输入关联事件' }]}><Input /></Form.Item>
          <Form.Item name="destination" label="调拨目的地" rules={[{ required: true, message: '请输入调拨目的地' }]}><Input /></Form.Item>
          <Form.Item name="quantity" label={`调拨数量${dispatchResource ? `（有效可调 ${getDispatchableEmergencyResourceQuantity(dispatchResource, today)} ${dispatchResource.unit}）` : ''}`} rules={[{ required: true }]}><InputNumber min={1} max={dispatchResource ? getDispatchableEmergencyResourceQuantity(dispatchResource, today) : undefined} precision={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="operator" label="调度人" rules={[{ required: true, message: '请输入调度人' }]}><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`资源巡检${inspectionResource ? ` · ${inspectionResource.name}` : ''}`} open={Boolean(inspectionResource)} okText="保存巡检" cancelText="取消" onOk={() => void submitInspection()} onCancel={() => setInspectionResourceId(undefined)} destroyOnClose>
        <Form form={inspectionForm} layout="vertical">
          <Form.Item name="inspector" label="检查人" rules={[{ required: true, message: '请输入检查人' }]}><Input /></Form.Item>
          <Form.Item name="result" label="检查结论" rules={[{ required: true }]}><Select options={['检查合格', '即将到期', '需要维护'].map((value) => ({ value }))} /></Form.Item>
          <Form.Item name="nextInspection" label="下次检查日期" rules={[{ required: true, message: '请输入下次检查日期' }, dateRule]}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name="note" label="检查记录" rules={[{ required: true, message: '请输入检查记录' }]}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`${historyResource?.code ?? ''} 操作记录`} open={Boolean(historyResource)} footer={null} onCancel={() => setHistoryResourceId(undefined)} width={700} destroyOnClose>
        {historyResource && <div className={styles.historyPanel}>
          <section><h3>调拨与归还</h3>{historyResource.dispatches.length ? [...historyResource.dispatches].reverse().map((item) => <article key={item.id}><Tag color={item.status === '已归还' ? 'default' : item.status === '已到位' ? 'success' : 'processing'}>{item.status}</Tag><div><strong>{item.eventName} · {item.quantity} {historyResource.unit}</strong><p>{item.destination} · {item.operator}{item.batchAllocations?.length ? ` · 批次 ${item.batchAllocations.map((batch) => `${batch.batchNo}×${batch.quantity}`).join('、')}` : ''}</p><small>调拨 {item.dispatchedAt}{item.arrivedAt ? ` · 到位 ${item.arrivedAt}` : ''}{item.returnedAt ? ` · 归还 ${item.returnedAt}` : ''}</small></div></article>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无调拨记录" />}</section>
          <section><h3>检查与维护</h3>{historyResource.inspectionRecords.length ? [...historyResource.inspectionRecords].reverse().map((item) => <article key={item.id}><Tag color={inspectionColor[item.result]}>{item.result}</Tag><div><strong>{item.inspector} · {item.inspectedAt}</strong><p>{item.note}</p><small>下次检查 {item.nextInspection}</small></div></article>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无巡检记录" />}</section>
        </div>}
      </Modal>
    </PageContainer>
  );
}
