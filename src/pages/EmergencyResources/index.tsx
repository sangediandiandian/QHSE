import type { EmergencyResource } from '@/types/qhse';
import {
  CarFilled,
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FireFilled,
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
import { Button, Empty, Input, Progress, Segmented, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

type ResourceType = EmergencyResource['type'] | '全部资源';

const typeIcon: Record<EmergencyResource['type'], React.ReactNode> = {
  消防: <FireFilled />, 气防: <SafetyCertificateFilled />, 医疗: <MedicineBoxFilled />, 物资: <ToolFilled />,
};

const inspectionColor: Record<EmergencyResource['inspectionStatus'], string> = {
  检查合格: 'success', 即将到期: 'warning', 需要维护: 'error',
};

export default function EmergencyResources() {
  const { dashboard, loading, loadDashboard, advanceEmergencyResource } = useModel('qhse');
  const [type, setType] = useState<ResourceType>('全部资源');
  const [status, setStatus] = useState('全部状态');
  const [query, setQuery] = useState('');

  useEffect(() => { if (!dashboard) void loadDashboard(); }, [dashboard, loadDashboard]);

  const resources = useMemo(() => (dashboard?.emergencyResources ?? []).filter((resource) => {
    const keyword = query.trim().toLowerCase();
    return (type === '全部资源' || resource.type === type)
      && (status === '全部状态' || resource.status === status)
      && (!keyword || `${resource.name}${resource.code}${resource.location}${resource.owner}`.toLowerCase().includes(keyword));
  }), [dashboard, query, status, type]);

  if (!dashboard && loading) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;
  if (!dashboard) return <PageContainer><Empty description="应急资源数据暂不可用" /></PageContainer>;

  const arrived = dashboard.emergencyResources.filter((item) => item.status === '已到位').length;
  const dispatching = dashboard.emergencyResources.filter((item) => item.status === '调度中').length;
  const readyRate = Math.round(((arrived + dispatching) / dashboard.emergencyResources.length) * 100);
  const maintenance = dashboard.emergencyResources.filter((item) => item.inspectionStatus !== '检查合格').length;

  return (
    <PageContainer title={false} className={styles.page} extra={<Button type="primary" icon={<CarFilled />}>新增资源</Button>}>
      <header className={styles.heading}>
        <div><span>EMERGENCY RESOURCE CONTROL</span><h1>应急资源管理</h1><p>统一掌握消防、气防、医疗和物资的可用状态、位置与现场调度进度。</p></div>
        <div className={styles.readiness}><i /><span>综合战备率<strong>{readyRate}%</strong><small>{arrived + dispatching} / {dashboard.emergencyResources.length} 项已响应</small></span></div>
      </header>

      <section className={styles.metrics} aria-label="资源战备指标">
        <div><span>资源总数</span><strong>{dashboard.emergencyResources.length}<em>项</em></strong><small>覆盖 4 个专业类别</small></div>
        <div><span>已到位</span><strong>{arrived}<em>项</em></strong><small><CheckCircleFilled /> 现场可立即投入</small></div>
        <div><span>调度途中</span><strong>{dispatching}<em>项</em></strong><small><SendOutlined /> 正在前往事件点</small></div>
        <div className={maintenance ? styles.warningMetric : ''}><span>检查关注</span><strong>{maintenance}<em>项</em></strong><small><WarningFilled /> 到期或需要维护</small></div>
      </section>

      <section className={styles.toolbar}>
        <Input prefix={<SearchOutlined />} placeholder="搜索资源、编号、位置或责任人" value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
        <Segmented value={status} onChange={(value) => setStatus(String(value))} options={['全部状态', '待命', '调度中', '已到位']} />
        <span>显示 {resources.length} / {dashboard.emergencyResources.length} 项</span>
      </section>

      <main className={styles.resourceLayout}>
        <nav className={styles.typeRail} aria-label="资源分类">
          <span>RESOURCE CLASS</span>
          {(['全部资源', '消防', '气防', '医疗', '物资'] as ResourceType[]).map((item) => {
            const count = item === '全部资源' ? dashboard.emergencyResources.length : dashboard.emergencyResources.filter((resource) => resource.type === item).length;
            return <button key={item} type="button" className={type === item ? styles.active : ''} onClick={() => setType(item)}><i>{item === '全部资源' ? <CarFilled /> : typeIcon[item]}</i><strong>{item}</strong><em>{count}</em></button>;
          })}
          <div className={styles.hotline}><PhoneFilled /><span>应急调度热线<strong>6000</strong><small>24 小时值守</small></span></div>
        </nav>

        <section className={styles.catalog}>
          <header><div><span>RESOURCE INVENTORY</span><h2>资源台账与调度</h2></div><Tag>{resources.length} 项资源</Tag></header>
          <div className={styles.resourceGrid}>{resources.map((resource) => (
            <article key={resource.id} className={`${styles.resourceCard} ${styles[resource.status]}`}>
              <header><i>{typeIcon[resource.type]}</i><div><code>{resource.code}</code><h3>{resource.name}</h3></div><em>{resource.status}</em></header>
              <div className={styles.quantity}>{resource.quantity}<span>{resource.type}资源</span></div>
              <dl><div><dt><EnvironmentOutlined /> 存放位置</dt><dd>{resource.location}</dd></div><div><dt><ClockCircleOutlined /> 预计到场</dt><dd>{resource.eta}</dd></div><div><dt><PhoneFilled /> 责任人</dt><dd>{resource.owner} · {resource.contact}</dd></div></dl>
              <footer><Tag color={inspectionColor[resource.inspectionStatus]}>{resource.inspectionStatus}</Tag><small>检查 {resource.lastInspection}</small><Button size="small" type={resource.status === '已到位' ? 'default' : 'primary'} disabled={resource.status === '已到位' || resource.inspectionStatus === '需要维护'} onClick={() => { advanceEmergencyResource(resource.id); message.success(resource.status === '待命' ? `${resource.name}已发起调度` : `${resource.name}已确认到位`); }}>{resource.status === '待命' ? '调度' : resource.status === '调度中' ? '确认到位' : '已到位'}</Button></footer>
            </article>
          ))}{resources.length === 0 && <Empty description="没有符合条件的应急资源" />}</div>
        </section>

        <aside className={styles.dispatchBoard}>
          <header><span>DISPATCH PIPELINE</span><h2>当前调度态势</h2></header>
          <div className={styles.pipeline}>
            {(['已到位', '调度中', '待命'] as EmergencyResource['status'][]).map((item) => {
              const list = dashboard.emergencyResources.filter((resource) => resource.status === item);
              return <section key={item}><div><i className={styles[item]} /><strong>{item}</strong><em>{list.length}</em></div>{list.map((resource) => <p key={resource.id}><span>{resource.name}</span><small>{resource.eta}</small></p>)}</section>;
            })}
          </div>
          <div className={styles.coverage}><span>资源响应覆盖</span><strong>{readyRate}%</strong><Progress percent={readyRate} showInfo={false} strokeColor="#1a7791" /><small>按已到位及调度中资源计算</small></div>
          <div className={styles.maintenance}><WarningFilled /><span>维护提示<strong>{maintenance} 项资源需要关注</strong><small>消防机器人需完成动力系统维护后方可调度</small></span></div>
        </aside>
      </main>
    </PageContainer>
  );
}
