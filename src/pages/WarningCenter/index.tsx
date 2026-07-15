import type { AlarmEvent, RiskLevel } from '@/types/qhse';
import { AlertFilled, CheckCircleFilled, ClockCircleFilled, FireFilled, SearchOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Button, Empty, Input, Segmented, Skeleton, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const levelText: Record<RiskLevel, string> = { low: '低风险', medium: '一般', high: '较大', critical: '重大' };

function EventRow({ event }: { event: AlarmEvent }) {
  return (
    <button type="button" className={styles.eventRow} onClick={() => history.push(`/warnings/${event.id}`)}>
      <span className={`${styles.level} ${styles[event.level]}`}><i />{levelText[event.level]}</span>
      <div className={styles.eventName}><strong>{event.title}</strong><small>{event.code} · {event.source}</small></div>
      <span className={styles.area}>{event.areaName}</span>
      <strong className={styles.value}>{event.value}</strong>
      <time>{event.occurredAt}</time>
      <Tag bordered={false}>{event.status}</Tag>
      <span className={styles.open}>查看详情 →</span>
    </button>
  );
}

export default function WarningCenter() {
  const { dashboard, loading, loadDashboard } = useModel('qhse');
  const [status, setStatus] = useState('全部');
  const [keyword, setKeyword] = useState('');

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const events = useMemo(() => (dashboard?.alarms ?? []).filter((event) => {
    const statusMatch = status === '全部' || event.status === status;
    const keywordMatch = !keyword || `${event.title}${event.areaName}${event.code}`.toLowerCase().includes(keyword.toLowerCase());
    return statusMatch && keywordMatch;
  }), [dashboard, keyword, status]);

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 12 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="预警数据暂不可用" /></PageContainer>;

  const pending = dashboard.alarms.filter((event) => event.status === '待确认').length;
  const processing = dashboard.alarms.filter((event) => event.status === '处置中').length;
  const major = dashboard.alarms.filter((event) => ['high', 'critical'].includes(event.level)).length;

  return (
    <PageContainer title={false} className={styles.page}>
      <section className={styles.hero}>
        <div><span>INTEGRATED WARNING CENTER</span><h1>综合预警中心</h1><p>多源异常在这里完成确认、研判、升级和应急处置。</p></div>
        <div className={styles.stats}>
          <div><AlertFilled /><strong>{pending}</strong><span>待确认</span></div>
          <div><ClockCircleFilled /><strong>{processing}</strong><span>处置中</span></div>
          <div><FireFilled /><strong>{major}</strong><span>较大及以上</span></div>
          <div><CheckCircleFilled /><strong>{dashboard.alarms.length}</strong><span>活动预警</span></div>
        </div>
      </section>

      <section className={styles.toolbar}>
        <Segmented value={status} onChange={(value) => setStatus(String(value))} options={['全部', '待确认', '已确认', '处置中', '监控中']} />
        <Input allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} prefix={<SearchOutlined />} placeholder="搜索事件、区域或编号" />
        <Button onClick={() => { setStatus('全部'); setKeyword(''); }}>重置筛选</Button>
      </section>

      <section className={styles.eventTable}>
        <header><span>风险等级</span><span>事件</span><span>装置区域</span><span>当前值</span><span>发生时间</span><span>状态</span><span>操作</span></header>
        {events.map((event) => <EventRow key={event.id} event={event} />)}
        {events.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的预警事件" />}
      </section>
    </PageContainer>
  );
}
