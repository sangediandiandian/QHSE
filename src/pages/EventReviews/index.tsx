import { downloadAttachment, uploadAttachment } from '@/services/qhse/attachments';
import type { EventReview, EventReviewActionInput, ReviewAction } from '@/types/qhse';
import {
  AlertFilled,
  AuditOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  FileDoneOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  SafetyCertificateFilled,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import { Button, Empty, Form, Input, Modal, Progress, Select, Skeleton, Tag, Upload, message } from 'antd';
import { useEffect, useState } from 'react';
import styles from './index.less';

const priorityColor: Record<ReviewAction['priority'], string> = { 一般: 'default', 重要: 'orange', 紧急: 'red' };
const statusColor: Record<ReviewAction['status'], string> = { 待整改: 'default', 整改中: 'processing', 已完成: 'success' };

export default function EventReviews() {
  const access = useAccess();
  const { dashboard, eventReviews, eventReviewLoading, eventReviewApiMode, loadEventReviews, advanceReviewAction, saveEventReviewAnalysis, addEventReviewEvidence, saveEventReviewAction, closeEventReview } = useModel('qhse');
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisSaving, setAnalysisSaving] = useState(false);
  const [analysisForm] = Form.useForm<Pick<EventReview, 'summary' | 'directCause' | 'rootCause' | 'lesson'>>();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File>();
  const [evidenceForm] = Form.useForm();
  const [actionOpen, setActionOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<ReviewAction>();
  const [actionForm] = Form.useForm<EventReviewActionInput>();
  useEffect(() => { void loadEventReviews(); }, [loadEventReviews]);

  if (eventReviewLoading && !eventReviews.length) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!eventReviews[0]) return <PageContainer><Empty description="暂无待复盘事件" /></PageContainer>;

  const review = eventReviews[0];
  const event = eventReviewApiMode
    ? { code: review.eventCode ?? review.eventId, title: review.eventTitle ?? review.summary, areaName: review.areaName ?? '--' }
    : dashboard?.alarms.find((item) => item.id === review.eventId) ?? dashboard?.alarms[0];
  const completed = review.actions.filter((action) => action.status === '已完成').length;
  const progress = Math.round((completed / review.actions.length) * 100);
  const analysisComplete = [review.summary, review.directCause, review.rootCause, review.lesson].every((item) => item.trim());
  const canClose = completed === review.actions.length && analysisComplete;
  const openAnalysis = () => {
    analysisForm.setFieldsValue({ summary: review.summary, directCause: review.directCause, rootCause: review.rootCause, lesson: review.lesson });
    setAnalysisOpen(true);
  };
  const submitAnalysis = async () => {
    const values = await analysisForm.validateFields();
    setAnalysisSaving(true);
    try {
      await saveEventReviewAnalysis(review.id, values);
      setAnalysisOpen(false);
      message.success('调查结论已保存');
    } finally {
      setAnalysisSaving(false);
    }
  };
  const openAction = (action?: ReviewAction) => {
    setEditingAction(action);
    actionForm.setFieldsValue(action ? { title: action.title, ownerDepartment: action.ownerDepartment, owner: action.owner, deadline: action.deadline, priority: action.priority } : { priority: '一般' });
    setActionOpen(true);
  };

  return (
    <PageContainer title={false} className={styles.page} extra={[<Button key="analysis" disabled={review.status === '已复盘' || (eventReviewApiMode && !access.canManageEmergency)} icon={<EditOutlined />} onClick={openAnalysis}>编辑调查结论</Button>, eventReviewApiMode && <Button key="evidence" disabled={review.status === '已复盘' || !access.canAddEmergencyEvidence} icon={<UploadOutlined />} onClick={() => setEvidenceOpen(true)}>归档调查附件</Button>, eventReviewApiMode && <Button key="action" disabled={review.status === '已复盘' || !access.canManageEmergency} icon={<PlusOutlined />} onClick={() => openAction()}>新增整改措施</Button>, <Button key="close" type="primary" disabled={!canClose || review.status === '已复盘' || (eventReviewApiMode && !access.canApproveEmergencyClosure)} icon={<FileDoneOutlined />} onClick={() => { void closeEventReview(review.id).then(() => message.success('事件已关闭，复盘报告和整改证据已归档')); }}>{review.status === '已复盘' ? '已关闭归档' : '关闭事件并归档'}</Button>]}>
      <header className={styles.heading}>
        <div><span>INCIDENT REVIEW / {review.reviewCode}</span><h1>事件关闭与复盘</h1><p>{event?.code} · {event?.title} · {event?.areaName}</p></div>
        <div className={styles.closeState}><i /><span>当前状态<strong>{review.status}</strong><small>{canClose ? '关闭条件已满足' : completed < review.actions.length ? `仍有 ${review.actions.length - completed} 项整改未完成` : '调查结论待完善'}</small></span></div>
      </header>

      <section className={styles.metrics} aria-label="事件复盘指标">
        <div><span>事件响应用时</span><strong>18<em>秒</em></strong><small>告警至人员确认</small></div>
        <div><span>风险控制用时</span><strong>19<em>分钟</em></strong><small>报警至泄漏源隔离</small></div>
        <div><span>通信送达率</span><strong>100<em>%</em></strong><small>7 次通知全部送达</small></div>
        <div><span>处置任务</span><strong>5<em>/5</em></strong><small>现场任务全部完成</small></div>
        <div><span>整改完成率</span><strong>{progress}<em>%</em></strong><Progress percent={progress} showInfo={false} strokeColor="#1a7791" /></div>
      </section>

      <main className={styles.reviewGrid}>
        <section className={`${styles.panel} ${styles.timelinePanel}`}>
          <header><span>EVENT CHRONOLOGY</span><h2>全过程时间轴</h2></header>
          <div className={styles.timeline}>{review.timeline.map((item) => (
            <article key={`${item.time}-${item.title}`} className={styles[item.status]}><time>{item.time}</time><i>{item.status === 'done' ? <CheckCircleFilled /> : item.status === 'active' ? <SafetyCertificateFilled /> : <ClockCircleOutlined />}</i><div><strong>{item.title}</strong><p>{item.detail}</p></div></article>
          ))}</div>
        </section>

        <section className={`${styles.panel} ${styles.analysisPanel}`}>
          <header><span>CAUSE ANALYSIS</span><h2>调查分析与经验反馈</h2></header>
          <article><b>01</b><div><span>事件摘要</span><p>{review.summary || '待补充'}</p></div></article>
          <article><b>02</b><div><span>直接原因</span><p>{review.directCause || '待补充'}</p></div></article>
          <article className={styles.rootCause}><b>03</b><div><span>根本原因</span><p>{review.rootCause || '待补充'}</p></div></article>
          <article><b>04</b><div><span>经验教训</span><p>{review.lesson || '待补充'}</p></div></article>
          <footer><AuditOutlined /><span>复盘负责人<strong>{review.reviewer}</strong></span><small>风险受控 {review.controlledAt}</small></footer>
        </section>

        <section className={`${styles.panel} ${styles.actionPanel}`}>
          <header><div><span>CORRECTIVE ACTIONS</span><h2>整改措施跟踪</h2></div><strong>{completed}/{review.actions.length}</strong></header>
          <div className={styles.actionList}>{review.actions.map((action, index) => (
            <article key={action.id}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <div><div><strong>{action.title}</strong><Tag color={priorityColor[action.priority]}>{action.priority}</Tag></div><p><TeamOutlined /> {action.ownerDepartment} · {action.owner}</p><small><ClockCircleOutlined /> 截止 {action.deadline}</small></div>
              <div className={styles.actionState}><Tag color={statusColor[action.status]}>{action.status}</Tag>{eventReviewApiMode && action.status !== '已完成' && <Button size="small" icon={<EditOutlined />} disabled={!access.canManageEmergency} onClick={() => openAction(action)}>调整</Button>}<Button size="small" disabled={action.status === '已完成' || (eventReviewApiMode && !access.canManageEmergency)} onClick={() => { void advanceReviewAction(review.id, action.id).then(() => message.success(action.status === '待整改' ? '整改措施已开始' : '整改措施已完成')); }}>{action.status === '待整改' ? '开始整改' : action.status === '整改中' ? '确认完成' : <CheckCircleFilled />}</Button></div>
            </article>
          ))}</div>
          <footer className={styles.closeChecklist}>
            <span><CheckCircleFilled /> 现场风险已解除</span><span><CheckCircleFilled /> 应急任务已完成</span><span className={canClose ? '' : styles.pending}><AlertFilled /> 整改措施全部完成</span><span className={canClose ? '' : styles.pending}><NodeIndexOutlined /> 关闭审批与知识归档</span>
          </footer>
        </section>
        {eventReviewApiMode && <section className={`${styles.panel} ${styles.actionPanel}`}><header><div><span>INVESTIGATION EVIDENCE</span><h2>调查附件</h2></div><strong>{review.evidence?.length ?? 0}</strong></header><div className={styles.actionList}>{review.evidence?.length ? review.evidence.map((item) => <article key={item.id}><b><UploadOutlined /></b><div><div><strong>{item.name}</strong><Tag>{item.category}</Tag></div><p>{item.note}</p><small>{item.uploader} · {item.uploadedAt} · {(item.size ?? 0) / 1024} KB</small></div><Button type="link" icon={<DownloadOutlined />} disabled={!access.canReadAttachment} onClick={() => void downloadAttachment(item.objectId, item.name)}>下载</Button></article>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无调查附件" />}</div></section>}
      </main>
      <Modal title="编辑调查结论" open={analysisOpen} confirmLoading={analysisSaving} onCancel={() => setAnalysisOpen(false)} onOk={() => void submitAnalysis()} okText="保存结论">
        <Form form={analysisForm} layout="vertical">
          <Form.Item name="summary" label="事件摘要" rules={[{ required: true, min: 2, message: '请填写事件摘要' }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="directCause" label="直接原因" rules={[{ required: true, min: 2, message: '请填写直接原因' }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="rootCause" label="根本原因" rules={[{ required: true, min: 2, message: '请填写根本原因' }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="lesson" label="经验教训" rules={[{ required: true, min: 2, message: '请填写经验教训' }]}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
      <Modal title="归档调查附件" open={evidenceOpen} onCancel={() => { setEvidenceOpen(false); setEvidenceFile(undefined); }} onOk={() => evidenceForm.validateFields().then(async (values) => { if (!evidenceFile || !review.areaId) { message.warning('请选择调查附件'); return; } const attachment = await uploadAttachment(evidenceFile, review.areaId); await addEventReviewEvidence(review.id, { ...values, objectId: attachment.id }); setEvidenceOpen(false); setEvidenceFile(undefined); evidenceForm.resetFields(); message.success('调查附件已归档'); })} okText="归档附件"><Form form={evidenceForm} layout="vertical"><Form.Item label="附件文件" required><Upload maxCount={1} fileList={evidenceFile ? [{ uid: 'review-evidence', name: evidenceFile.name, status: 'done' }] : []} beforeUpload={(file) => { setEvidenceFile(file); evidenceForm.setFieldValue('name', file.name); return false; }} onRemove={() => { setEvidenceFile(undefined); return true; }}><Button icon={<UploadOutlined />} disabled={!access.canUploadAttachment}>选择文件</Button></Upload></Form.Item><Form.Item name="name" label="附件名称" rules={[{ required: true, min: 2 }]}><Input /></Form.Item><Form.Item name="category" label="附件类别" rules={[{ required: true }]}><Select options={['调查报告', '现场照片', '检测报告', '培训记录'].map((value) => ({ value }))} /></Form.Item><Form.Item name="note" label="附件说明" rules={[{ required: true, min: 2 }]}><Input.TextArea rows={3} /></Form.Item></Form></Modal>
      <Modal title={editingAction ? '调整整改措施' : '新增整改措施'} open={actionOpen} onCancel={() => { setActionOpen(false); setEditingAction(undefined); actionForm.resetFields(); }} onOk={() => actionForm.validateFields().then(async (values) => { await saveEventReviewAction(review.id, editingAction?.id, values); setActionOpen(false); setEditingAction(undefined); actionForm.resetFields(); message.success(editingAction ? '整改措施已调整' : '整改措施已新增'); })} okText="保存措施"><Form form={actionForm} layout="vertical"><Form.Item name="title" label="整改措施" rules={[{ required: true, min: 2 }]}><Input /></Form.Item><Form.Item name="ownerDepartment" label="责任部门" rules={[{ required: true, min: 2 }]}><Input /></Form.Item><Form.Item name="owner" label="责任人" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="deadline" label="完成期限" rules={[{ required: true }]}><Input type="date" /></Form.Item><Form.Item name="priority" label="优先级" rules={[{ required: true }]}><Select options={['一般', '重要', '紧急'].map((value) => ({ value }))} /></Form.Item></Form></Modal>
    </PageContainer>
  );
}
