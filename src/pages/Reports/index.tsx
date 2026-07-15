import type { ReportAreaRow, ReportExportJob, ReportMetric, ReportSummary } from '@/types/qhse';
import {
  createReportExport,
  downloadReportExport,
  getReportExport,
  getReportSummary,
} from '@/services/qhse/reports';
import {
  AlertFilled,
  CheckCircleFilled,
  DownloadOutlined,
  FileProtectOutlined,
  PartitionOutlined,
  ReloadOutlined,
  SafetyCertificateFilled,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import {
  Button,
  DatePicker,
  Empty,
  Progress,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const { RangePicker } = DatePicker;

function MetricCard({
  icon,
  title,
  metric,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  metric: ReportMetric;
  detail: string;
}) {
  return (
    <article>
      <i>{icon}</i>
      <span>
        {title}
        <strong>{metric.total}</strong>
        <small>{detail}</small>
      </span>
      <Progress type="circle" size={54} percent={metric.rate} format={(value) => `${value}%`} />
    </article>
  );
}

export default function Reports() {
  const access = useAccess();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()]);
  const [areaId, setAreaId] = useState<string>();
  const [report, setReport] = useState<ReportSummary>();
  const [areaOptions, setAreaOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [exportJob, setExportJob] = useState<ReportExportJob>();

  const query = useMemo(
    () => ({
      from: range[0].format('YYYY-MM-DD'),
      to: range[1].format('YYYY-MM-DD'),
      areaId,
    }),
    [areaId, range],
  );
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReportSummary(query);
      setReport(data);
      if (!areaId) {
        setAreaOptions(data.areas.map((item) => ({ value: item.areaId, label: item.areaName })));
      }
    } finally {
      setLoading(false);
    }
  }, [areaId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!exportJob || !['queued', 'processing'].includes(exportJob.status)) return undefined;
    const timer = window.setInterval(() => {
      void getReportExport(exportJob.id)
        .then((job) => {
          setExportJob(job);
          if (job.status === 'completed') {
            window.clearInterval(timer);
            void downloadReportExport(job).then(() => message.success('后台报表已生成并下载'));
          } else if (job.status === 'failed') {
            window.clearInterval(timer);
            message.error('后台报表生成失败，请重试');
          }
        })
        .catch(() => {
          window.clearInterval(timer);
          setExportJob(undefined);
          message.error('无法查询后台导出任务，请重试');
        });
    }, 800);
    return () => window.clearInterval(timer);
  }, [exportJob]);

  const trend = report?.trend.slice(-30) ?? [];
  const trendMax = Math.max(
    1,
    ...trend.map((item) => item.hazardCreated + item.warningTriggered + item.emergencyCreated),
  );
  const columns: ColumnsType<ReportAreaRow> = [
    { title: '区域', dataIndex: 'areaName', fixed: 'left', width: 150 },
    {
      title: '风险指数',
      dataIndex: 'riskIndex',
      width: 100,
      render: (value: number) => (
        <Tag color={value >= 20 ? 'error' : value >= 10 ? 'warning' : 'success'}>{value}</Tag>
      ),
    },
    { title: '隐患', dataIndex: 'hazardTotal', width: 80 },
    { title: '未闭环', dataIndex: 'hazardOpen', width: 90 },
    { title: '逾期', dataIndex: 'hazardOverdue', width: 70 },
    {
      title: '闭环率',
      dataIndex: 'hazardClosureRate',
      width: 90,
      render: (value: number) => `${value}%`,
    },
    { title: '预警', dataIndex: 'warningTotal', width: 80 },
    { title: '重大预警', dataIndex: 'warningCritical', width: 100 },
    { title: '活动作业票', dataIndex: 'permitActive', width: 110 },
    { title: '未关闭事件', dataIndex: 'emergencyOpen', width: 110 },
  ];

  return (
    <PageContainer title={false} className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span>QHSE PERFORMANCE ANALYTICS</span>
          <h1>统计报表中心</h1>
          <p>统一复算隐患、预警、作业许可和应急事件指标，所有结果受账号区域数据范围约束。</p>
        </div>
        <Space wrap>
          <RangePicker
            value={range}
            allowClear={false}
            disabledDate={(date) => date.isAfter(dayjs(), 'day')}
            onChange={(values) => values?.[0] && values[1] && setRange([values[0], values[1]])}
          />
          <Select
            allowClear
            value={areaId}
            placeholder="全部可见区域"
            options={areaOptions}
            onChange={setAreaId}
            style={{ width: 180 }}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            disabled={!access.canExportReport}
            loading={Boolean(exportJob && ['queued', 'processing'].includes(exportJob.status))}
            onClick={() => {
              void createReportExport(query).then((job) => {
                setExportJob(job);
                message.info('导出任务已进入后台队列');
              });
            }}
          >
            {exportJob && ['queued', 'processing'].includes(exportJob.status)
              ? '后台生成中'
              : '导出 CSV'}
          </Button>
        </Space>
      </header>

      {loading && !report ? (
        <Skeleton active paragraph={{ rows: 14 }} />
      ) : report ? (
        <>
          <section className={styles.metrics}>
            <MetricCard
              icon={<SafetyCertificateFilled />}
              title="期间隐患"
              metric={report.hazards}
              detail={`未闭环 ${report.hazards.open} · 逾期 ${report.hazards.overdue ?? 0}`}
            />
            <MetricCard
              icon={<AlertFilled />}
              title="有效预警"
              metric={report.warnings}
              detail={`活动 ${report.warnings.active ?? 0} · 重大 ${report.warnings.critical ?? 0}`}
            />
            <MetricCard
              icon={<FileProtectOutlined />}
              title="作业许可"
              metric={report.permits}
              detail={`活动作业票 ${report.permits.active ?? 0}`}
            />
            <MetricCard
              icon={<PartitionOutlined />}
              title="应急事件"
              metric={report.emergencies}
              detail={`未关闭 ${report.emergencies.open} · 已关闭 ${report.emergencies.closed}`}
            />
          </section>

          <section className={styles.analysis}>
            <div className={styles.trendPanel}>
              <header>
                <div>
                  <CheckCircleFilled />
                  <span>
                    近 30 天新增趋势<small>隐患 / 预警 / 应急事件</small>
                  </span>
                </div>
                <em>生成于 {dayjs(report.generatedAt).format('YYYY-MM-DD HH:mm:ss')}</em>
              </header>
              {trend.length ? (
                <div className={styles.trend}>
                  {trend.map((item) => (
                    <div
                      key={item.date}
                      title={`${item.date}：隐患 ${item.hazardCreated}，预警 ${item.warningTriggered}，事件 ${item.emergencyCreated}`}
                    >
                      <span>
                        <i style={{ height: `${(item.hazardCreated / trendMax) * 100}%` }} />
                        <i style={{ height: `${(item.warningTriggered / trendMax) * 100}%` }} />
                        <i style={{ height: `${(item.emergencyCreated / trendMax) * 100}%` }} />
                      </span>
                      <small>{item.date.slice(5)}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="所选周期暂无趋势数据" />
              )}
              <footer>
                <span>
                  <i />
                  隐患新增
                </span>
                <span>
                  <i />
                  预警触发
                </span>
                <span>
                  <i />
                  事件新增
                </span>
              </footer>
            </div>
            <div className={styles.formula}>
              <AlertFilled />
              <h3>区域风险指数</h3>
              <p>用于报表内排序，不替代风险分级结果。</p>
              <code>未闭环隐患×2 + 逾期×3 + 预警×2 + 重大预警×5 + 活动作业票 + 未关闭事件×4</code>
            </div>
          </section>

          <section className={styles.tablePanel}>
            <header>
              <h2>区域绩效明细</h2>
              <span>
                {report.range.from} 至 {report.range.to}
              </span>
            </header>
            <Table<ReportAreaRow>
              rowKey="areaId"
              size="middle"
              loading={loading}
              pagination={false}
              scroll={{ x: 1070 }}
              columns={columns}
              dataSource={report.areas}
              locale={{ emptyText: <Empty description="所选范围暂无业务数据" /> }}
            />
          </section>
        </>
      ) : (
        <Empty description="统计数据暂不可用" />
      )}
    </PageContainer>
  );
}
