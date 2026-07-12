import type { EmergencyPlanTemplate } from '@/types/qhse';
import {
  ApartmentOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FileProtectOutlined,
  FilterOutlined,
  NotificationOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Button, Empty, Input, Segmented, Skeleton, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

type Category = EmergencyPlanTemplate['category'] | '全部预案';

const categories: Category[] = ['全部预案', '综合应急预案', '专项应急预案', '现场处置方案', '岗位应急处置卡'];

const levelColor: Record<EmergencyPlanTemplate['responseLevel'], string> = {
  'IV级': 'default', 'III级': 'blue', 'II级': 'orange', 'I级': 'red',
};

export default function EmergencyPlans() {
  const { dashboard, loading, loadDashboard } = useModel('qhse');
  const [category, setCategory] = useState<Category>('全部预案');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('tpl-001');
  const [status, setStatus] = useState('全部状态');

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const plans = useMemo(() => (dashboard?.emergencyPlans ?? []).filter((plan) => {
    const categoryMatch = category === '全部预案' || plan.category === category;
    const statusMatch = status === '全部状态' || plan.status === status;
    const keyword = query.trim().toLowerCase();
    const queryMatch = !keyword || `${plan.name}${plan.code}${plan.eventType}${plan.applicableArea}`.toLowerCase().includes(keyword);
    return categoryMatch && statusMatch && queryMatch;
  }), [category, dashboard, query, status]);

  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0] ?? dashboard?.emergencyPlans[0];

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard || !selected) return <PageContainer><Empty description="预案数据暂不可用" /></PageContainer>;

  const activeCount = dashboard.emergencyPlans.filter((plan) => plan.status === '生效中').length;
  const reviewCount = dashboard.emergencyPlans.filter((plan) => plan.status === '待评审').length;

  return (
    <PageContainer title={false} className={styles.page} extra={<Button type="primary" icon={<FileProtectOutlined />}>新建预案</Button>}>
      <header className={styles.heading}>
        <div><span>EMERGENCY PLAN LIBRARY</span><h1>应急预案库</h1><p>统一维护预案触发条件、处置步骤、通知对象、资源清单与版本状态。</p></div>
        <div className={styles.summary}>
          <div><strong>{dashboard.emergencyPlans.length}</strong><span>预案总数</span></div>
          <div><strong>{activeCount}</strong><span>生效中</span></div>
          <div className={styles.review}><strong>{reviewCount}</strong><span>待评审</span></div>
        </div>
      </header>

      <section className={styles.toolbar}>
        <Input prefix={<SearchOutlined />} placeholder="搜索预案名称、编号、区域或事件类型" value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
        <Segmented value={status} onChange={(value) => setStatus(String(value))} options={['全部状态', '生效中', '待评审']} />
        <span><FilterOutlined /> 当前显示 {plans.length} 套</span>
      </section>

      <main className={styles.libraryGrid}>
        <nav className={styles.categoryRail} aria-label="预案分类">
          <span>PLAN CLASS</span>
          {categories.map((item) => {
            const count = item === '全部预案' ? dashboard.emergencyPlans.length : dashboard.emergencyPlans.filter((plan) => plan.category === item).length;
            return <button key={item} type="button" className={category === item ? styles.active : ''} onClick={() => setCategory(item)}><i>{item === '全部预案' ? <ApartmentOutlined /> : <FileProtectOutlined />}</i><strong>{item}</strong><em>{count}</em></button>;
          })}
          <div className={styles.coverage}><SafetyCertificateOutlined /><strong>12 类事故场景</strong><span>覆盖泄漏、火灾、环保、公用工程等风险</span></div>
        </nav>

        <section className={styles.catalog}>
          <header><span>PLAN CATALOG</span><h2>预案目录</h2></header>
          <div className={styles.planList}>
            {plans.map((plan) => (
              <button key={plan.id} type="button" className={`${styles.planCard} ${selected.id === plan.id ? styles.selected : ''}`} onClick={() => setSelectedId(plan.id)}>
                <div className={styles.planTop}><Tag color={levelColor[plan.responseLevel]}>{plan.responseLevel}</Tag><em className={plan.status === '待评审' ? styles.pending : ''}>{plan.status}</em></div>
                <strong>{plan.name}</strong><code>{plan.code}</code>
                <div className={styles.planMeta}><span>{plan.category}</span><span>{plan.applicableArea}</span></div>
                <footer><span><ClockCircleOutlined /> {plan.effectiveDate}</span><b>{plan.version}</b></footer>
              </button>
            ))}
            {plans.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的预案" />}
          </div>
        </section>

        <aside className={styles.planDetail}>
          <header><div><span>PLAN DOSSIER</span><h2>{selected.name}</h2></div><Tag color={selected.status === '生效中' ? 'success' : 'warning'}>{selected.status}</Tag></header>
          <div className={styles.identity}><code>{selected.code}</code><b>{selected.version}</b><span>{selected.ownerDepartment}</span></div>
          <section className={styles.ruleBox}><span>MATCH RULE / 触发规则</span><p>{selected.triggerRule}</p><div><Tag>{selected.eventType}</Tag><Tag>{selected.medium}</Tag><Tag color={levelColor[selected.responseLevel]}>{selected.responseLevel}响应</Tag></div></section>

          <section className={styles.detailSection}><h3><RocketOutlined /> 关键处置步骤</h3><ol>{selected.steps.map((step) => <li key={step}><i /><span>{step}</span></li>)}</ol></section>
          <section className={styles.detailSection}><h3><NotificationOutlined /> 通知对象</h3><div className={styles.chips}>{selected.notificationTargets.map((target) => <span key={target}><TeamOutlined /> {target}</span>)}</div></section>
          <section className={styles.detailSection}><h3><ToolOutlined /> 应急资源</h3><div className={styles.chips}>{selected.resources.map((resource) => <span key={resource}>{resource}</span>)}</div></section>

          <footer className={styles.detailFooter}>
            <div><CheckCircleFilled /><span>生效日期<strong>{selected.effectiveDate}</strong></span></div>
            <Button type="primary" disabled={selected.status !== '生效中'} onClick={() => history.push('/emergency')}>进入应急指挥台</Button>
          </footer>
        </aside>
      </main>
    </PageContainer>
  );
}
