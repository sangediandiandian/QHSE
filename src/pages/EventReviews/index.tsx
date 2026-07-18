import type { ReviewAction } from '@/types/qhse';
import {
  AlertFilled,
  AuditOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FileDoneOutlined,
  NodeIndexOutlined,
  SafetyCertificateFilled,
  TeamOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import { Button, Empty, Progress, Skeleton, Tag, message } from 'antd';
import { useEffect } from 'react';
import styles from './index.less';

const priorityColor: Record<ReviewAction['priority'], string> = { 一般: 'default', 重要: 'orange', 紧急: 'red' };
const statusColor: Record<ReviewAction['status'], string> = { 待整改: 'default', 整改中: 'processing', 已完成: 'success' };

export default function EventReviews() {
  const access = useAccess();
  const { dashboard, eventReviews, eventReviewLoading, eventReviewApiMode, loadEventReviews, advanceReviewAction, closeEventReview } = useModel('qhse');
  useEffect(() => { void loadEventReviews(); }, [loadEventReviews]);

  if (eventReviewLoading && !eventReviews.length) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!eventReviews[0]) return <PageContainer><Empty description="暂无待复盘事件" /></PageContainer>;

  const review = eventReviews[0];
  const event = eventReviewApiMode
    ? { code: review.eventCode ?? review.eventId, title: review.eventTitle ?? review.summary, areaName: review.areaName ?? '--' }
    : dashboard?.alarms.find((item) => item.id === review.eventId) ?? dashboard?.alarms[0];
  const completed = review.actions.filter((action) => action.status === '已完成').length;
  const progress = Math.round((completed / review.actions.length) * 100);
  const canClose = completed === review.actions.length;

  return (
    <PageContainer title={false} className={styles.page} extra={<Button type="primary" disabled={!canClose || review.status === '已复盘' || (eventReviewApiMode && !access.canApproveEmergencyClosure)} icon={<FileDoneOutlined />} onClick={() => { void closeEventReview(review.id).then(() => message.success('事件已关闭，复盘报告和整改证据已归档')); }}>{review.status === '已复盘' ? '已关闭归档' : '关闭事件并归档'}</Button>}>
      <header className={styles.heading}>
        <div><span>INCIDENT REVIEW / {review.reviewCode}</span><h1>事件关闭与复盘</h1><p>{event?.code} · {event?.title} · {event?.areaName}</p></div>
        <div className={styles.closeState}><i /><span>当前状态<strong>{review.status}</strong><small>{canClose ? '关闭条件已满足' : `仍有 ${review.actions.length - completed} 项整改未完成`}</small></span></div>
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
          <article><b>01</b><div><span>事件摘要</span><p>{review.summary}</p></div></article>
          <article><b>02</b><div><span>直接原因</span><p>{review.directCause}</p></div></article>
          <article className={styles.rootCause}><b>03</b><div><span>根本原因</span><p>{review.rootCause}</p></div></article>
          <article><b>04</b><div><span>经验教训</span><p>{review.lesson}</p></div></article>
          <footer><AuditOutlined /><span>复盘负责人<strong>{review.reviewer}</strong></span><small>风险受控 {review.controlledAt}</small></footer>
        </section>

        <section className={`${styles.panel} ${styles.actionPanel}`}>
          <header><div><span>CORRECTIVE ACTIONS</span><h2>整改措施跟踪</h2></div><strong>{completed}/{review.actions.length}</strong></header>
          <div className={styles.actionList}>{review.actions.map((action, index) => (
            <article key={action.id}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <div><div><strong>{action.title}</strong><Tag color={priorityColor[action.priority]}>{action.priority}</Tag></div><p><TeamOutlined /> {action.ownerDepartment} · {action.owner}</p><small><ClockCircleOutlined /> 截止 {action.deadline}</small></div>
              <div className={styles.actionState}><Tag color={statusColor[action.status]}>{action.status}</Tag><Button size="small" disabled={action.status === '已完成' || (eventReviewApiMode && !access.canManageEmergency)} onClick={() => { void advanceReviewAction(review.id, action.id).then(() => message.success(action.status === '待整改' ? '整改措施已开始' : '整改措施已完成')); }}>{action.status === '待整改' ? '开始整改' : action.status === '整改中' ? '确认完成' : <CheckCircleFilled />}</Button></div>
            </article>
          ))}</div>
          <footer className={styles.closeChecklist}>
            <span><CheckCircleFilled /> 现场风险已解除</span><span><CheckCircleFilled /> 应急任务已完成</span><span className={canClose ? '' : styles.pending}><AlertFilled /> 整改措施全部完成</span><span className={canClose ? '' : styles.pending}><NodeIndexOutlined /> 关闭审批与知识归档</span>
          </footer>
        </section>
      </main>
    </PageContainer>
  );
}
