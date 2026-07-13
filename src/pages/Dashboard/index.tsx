import FactoryMap from '@/components/FactoryMap';
import type { PlantArea, RiskLevel, TrendPoint } from '@/types/qhse';
import { isWarningScenarioEnabled } from '@/utils/warningRules';
import {
  AlertFilled,
  ApiOutlined,
  CheckCircleFilled,
  DesktopOutlined,
  ExperimentOutlined,
  FireOutlined,
  NotificationOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Button, Skeleton, Space, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const riskLabel: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '一般风险',
  high: '较大风险',
  critical: '重大风险',
};

function MiniTrend({ data }: { data: TrendPoint[] }) {
  const points = (key: 'gds' | 'voc' | 'mes') =>
    data.map((item, index) => `${(index / (data.length - 1)) * 100},${76 - item[key]}`).join(' ');
  return (
    <div className={styles.trend}>
      <svg
        viewBox="0 0 100 80"
        preserveAspectRatio="none"
        role="img"
        aria-label="GDS、VOC、MES近一小时趋势"
      >
        <line x1="0" y1="60" x2="100" y2="60" />
        <line x1="0" y1="30" x2="100" y2="30" />
        <polyline className={styles.gdsLine} points={points('gds')} />
        <polyline className={styles.vocLine} points={points('voc')} />
        <polyline className={styles.mesLine} points={points('mes')} />
      </svg>
      <div className={styles.trendLabels}>
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
      <div className={styles.trendLegend}>
        <span className={styles.gdsDot}>GDS / %LEL</span>
        <span className={styles.vocDot}>VOC / mg·m³</span>
        <span className={styles.mesDot}>MES / 负荷指数</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { dashboard, loading, loadDashboard, simulateGdsAlarm } = useModel('qhse');
  const [selectedArea, setSelectedArea] = useState<PlantArea>();

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const selectedAlarms = useMemo(
    () =>
      selectedArea
        ? (dashboard?.alarms.filter((item) => item.areaId === selectedArea.id) ?? [])
        : [],
    [dashboard, selectedArea],
  );

  if (!dashboard && loading)
    return (
      <PageContainer>
        <Skeleton active paragraph={{ rows: 12 }} />
      </PageContainer>
    );
  if (!dashboard)
    return (
      <PageContainer>
        <div className={styles.empty}>
          驾驶舱数据暂不可用 <Button onClick={() => void loadDashboard()}>重新加载</Button>
        </div>
      </PageContainer>
    );

  const { metrics } = dashboard;
  const handleSimulation = () => {
    if (!isWarningScenarioEnabled(dashboard, 'gds-level2')) {
      message.info('GDS 二级报警规则已停用，请先在预警规则页面启用');
      return;
    }
    simulateGdsAlarm();
    message.warning('已触发 GDS-101 二级报警，常减压装置升级为重大风险');
  };

  return (
    <PageContainer
      title={false}
      className={styles.page}
      extra={
        <Space>
          <Button icon={<DesktopOutlined />} onClick={() => history.push('/screen')}>
            展示大屏
          </Button>
          <Button danger icon={<AlertFilled />} onClick={handleSimulation}>
            模拟 GDS 二级报警
          </Button>
        </Space>
      }
    >
      <section className={styles.masthead}>
        <div>
          <span className={styles.eyebrow}>QHSE OPERATION OVERVIEW</span>
          <h1>企业安全运行态势</h1>
          <p>统一监测 GDS、VOC 与生产工艺数据，异常正在按风险等级进入处置队列。</p>
        </div>
        <div className={styles.shift}>
          <span>当前班次</span>
          <strong>甲班 · 白班</strong>
          <small>
            <i /> 数据更新 {dashboard.updatedAt}
          </small>
        </div>
      </section>

      <section className={styles.metricGrid} aria-label="企业运行核心指标">
        <article className={`${styles.metric} ${styles.riskMetric}`}>
          <span>企业综合风险</span>
          <strong>{metrics.overallRisk}</strong>
          <small>
            <SafetyCertificateOutlined /> 较昨日风险持平
          </small>
        </article>
        <article className={styles.metric}>
          <span>GDS 在线率</span>
          <strong>
            {metrics.gdsOnlineRate}
            <em>%</em>
          </strong>
          <small>
            <ApiOutlined /> 29 / 30 测点在线
          </small>
        </article>
        <article className={styles.metric}>
          <span>当前活动告警</span>
          <strong>
            {metrics.activeAlarms}
            <em>项</em>
          </strong>
          <small className={styles.alertText}>
            <AlertFilled /> 1 项待立即确认
          </small>
        </article>
        <article className={styles.metric}>
          <span>VOC 达标率</span>
          <strong>
            {metrics.vocComplianceRate}
            <em>%</em>
          </strong>
          <small>
            <CheckCircleFilled /> 8 个监测点
          </small>
        </article>
        <article className={styles.metric}>
          <span>MES 异常参数</span>
          <strong>
            {metrics.mesAnomalies}
            <em>项</em>
          </strong>
          <small>
            <ExperimentOutlined /> 集中于 2 套装置
          </small>
        </article>
        <article className={styles.metric}>
          <span>通信送达率</span>
          <strong>
            {metrics.deliveryRate}
            <em>%</em>
          </strong>
          <small>
            <NotificationOutlined /> 今日发送 58 次
          </small>
        </article>
      </section>

      <section className={styles.mainGrid}>
        <article className={`${styles.panel} ${styles.mapPanel}`}>
          <header>
            <div>
              <span>PLANT RISK MAP</span>
              <h2>厂区装置风险态势</h2>
            </div>
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={() => {
                setSelectedArea(undefined);
                void loadDashboard();
              }}
            >
              刷新
            </Button>
          </header>
          <FactoryMap
            areas={dashboard.areas}
            selectedId={selectedArea?.id}
            onSelect={setSelectedArea}
          />
        </article>

        <article className={`${styles.panel} ${styles.alarmPanel}`}>
          <header>
            <div>
              <span>LIVE EVENT QUEUE</span>
              <h2>{selectedArea ? `${selectedArea.shortName}事件` : '实时事件队列'}</h2>
            </div>
            {selectedArea && (
              <Button type="link" onClick={() => setSelectedArea(undefined)}>
                查看全部
              </Button>
            )}
          </header>
          {selectedArea && (
            <div className={styles.areaBrief}>
              <strong>{riskLabel[selectedArea.riskLevel]}</strong>
              <span>{selectedArea.name}</span>
              <small>{selectedAlarms.length} 个关联事件</small>
            </div>
          )}
          <div className={styles.alarmList}>
            {(selectedArea ? selectedAlarms : dashboard.alarms).map((alarm) => (
              <button
                key={alarm.id}
                type="button"
                className={styles.alarmItem}
                onClick={() => history.push(`/warnings/${alarm.id}`)}
              >
                <div className={`${styles.levelBar} ${styles[alarm.level]}`} />
                <div className={styles.alarmContent}>
                  <div>
                    <Tag bordered={false}>{alarm.source}</Tag>
                    <time>{alarm.occurredAt}</time>
                  </div>
                  <strong>{alarm.title}</strong>
                  <span>
                    {alarm.areaName} · {alarm.value}
                  </span>
                </div>
                <em>{alarm.status}</em>
              </button>
            ))}
            {selectedArea && selectedAlarms.length === 0 && (
              <div className={styles.noAlarm}>
                <CheckCircleFilled /> 该装置当前无关联事件
              </div>
            )}
          </div>
          <Button block onClick={() => history.push('/warnings')}>
            进入综合预警中心
          </Button>
        </article>
      </section>

      <section className={styles.lowerGrid}>
        <article className={`${styles.panel} ${styles.trendPanel}`}>
          <header>
            <div>
              <span>60 MINUTE CORRELATION</span>
              <h2>多源数据关联趋势</h2>
            </div>
            <Tag color="processing">10 分钟粒度</Tag>
          </header>
          <MiniTrend data={dashboard.trend} />
        </article>
        <article className={`${styles.panel} ${styles.todoPanel}`}>
          <header>
            <div>
              <span>CLOSED-LOOP STATUS</span>
              <h2>处置闭环</h2>
            </div>
          </header>
          <div className={styles.todoRows}>
            <div>
              <FireOutlined />
              <span>高风险作业</span>
              <strong>{metrics.highRiskPermits}</strong>
              <small>项进行中</small>
            </div>
            <div>
              <AlertFilled />
              <span>待确认预警</span>
              <strong>{metrics.pendingWarnings}</strong>
              <small>项需处理</small>
            </div>
            <div>
              <CheckCircleFilled />
              <span>今日闭环率</span>
              <strong>
                87<em>%</em>
              </strong>
              <small>13 / 15 已关闭</small>
            </div>
          </div>
        </article>
      </section>
    </PageContainer>
  );
}
