import type { SystemDiagnostics } from '@/types/qhse';
import { getSystemDiagnostics } from '@/services/qhse/diagnostics';
import {
  ApiOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  FieldTimeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Progress, Skeleton, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import styles from './index.less';

const bytes = (value: number) => `${(value / 1024 / 1024).toFixed(1)} MB`;

export default function DiagnosticsPage() {
  const [data, setData] = useState<SystemDiagnostics>();
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getSystemDiagnostics());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!data)
    return (
      <PageContainer>
        <Skeleton active paragraph={{ rows: 14 }} />
      </PageContainer>
    );
  const heapRate = data.memory.heapTotalBytes
    ? Math.round((data.memory.heapUsedBytes / data.memory.heapTotalBytes) * 100)
    : 0;
  const routeColumns: ColumnsType<SystemDiagnostics['requests']['routes'][number]> = [
    { title: '方法', dataIndex: 'method', width: 80, render: (value) => <Tag>{value}</Tag> },
    { title: '路由模板', dataIndex: 'path', render: (value) => <code>{value}</code> },
    { title: '请求数', dataIndex: 'count', width: 90 },
    { title: '错误数', dataIndex: 'errorCount', width: 90 },
    { title: '错误率', dataIndex: 'errorRate', width: 90, render: (value) => `${value}%` },
    {
      title: '平均耗时',
      dataIndex: 'averageDurationMs',
      width: 110,
      render: (value) => `${value} ms`,
    },
    { title: '最大耗时', dataIndex: 'durationMaxMs', width: 110, render: (value) => `${value} ms` },
    {
      title: '最近状态',
      dataIndex: 'lastStatus',
      width: 100,
      render: (value) => (
        <Tag color={value >= 500 ? 'error' : value >= 400 ? 'warning' : 'success'}>{value}</Tag>
      ),
    },
  ];

  return (
    <PageContainer title={false} className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span>RUNTIME OBSERVABILITY</span>
          <h1>运行诊断</h1>
          <p>
            查看当前 API 进程、存储模式、内存、集成登记与低基数路由指标。诊断数据仅对授权角色开放。
          </p>
        </div>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void load()}
        >
          立即刷新
        </Button>
      </header>
      <section className={styles.metrics}>
        <article>
          <CloudServerOutlined />
          <span>
            API 状态<strong>{data.service.status}</strong>
            <small>
              {data.service.nodeVersion} · 已运行 {Math.floor(data.service.uptimeSeconds / 60)} 分钟
            </small>
          </span>
        </article>
        <article>
          <DatabaseOutlined />
          <span>
            数据与对象存储
            <strong>
              {data.service.repository} / {data.service.objectStorage}
            </strong>
            <small>运行时适配器模式</small>
          </span>
        </article>
        <article>
          <ApiOutlined />
          <span>
            累计请求<strong>{data.requests.totalRequests}</strong>
            <small>
              错误 {data.requests.totalErrors} · 路由 {data.requests.routes.length}
            </small>
          </span>
        </article>
        <article>
          <FieldTimeOutlined />
          <span>
            Heap 使用<strong>{bytes(data.memory.heapUsedBytes)}</strong>
            <small>RSS {bytes(data.memory.rssBytes)}</small>
          </span>
          <Progress type="circle" size={50} percent={heapRate} />
        </article>
      </section>
      <section className={styles.grid}>
        <div className={styles.panel}>
          <header>
            <h2>集成状态登记</h2>
            <Space>
              <Tag>总计 {data.integrations.total}</Tag>
              <Tag color="processing">启用 {data.integrations.enabled}</Tag>
              <Tag color={data.integrations.unhealthy ? 'error' : 'success'}>
                异常 {data.integrations.unhealthy}
              </Tag>
            </Space>
          </header>
          {data.integrations.items.map((item) => (
            <article key={item.code}>
              <span>
                <code>{item.code}</code>
                <strong>{item.name}</strong>
                <small>
                  {item.owner} · {item.type}
                </small>
              </span>
              <Space>
                <Tag color={item.enabled ? 'success' : 'default'}>
                  {item.enabled ? '启用' : '停用'}
                </Tag>
                <Tag>{item.healthStatus === 'unchecked' ? '待检测' : item.healthStatus}</Tag>
              </Space>
            </article>
          ))}
        </div>
        <div className={styles.panel}>
          <header>
            <h2>进程内存</h2>
            <span>采样 {dayjs(data.generatedAt).format('HH:mm:ss')}</span>
          </header>
          <dl>
            <div>
              <dt>RSS</dt>
              <dd>{bytes(data.memory.rssBytes)}</dd>
            </div>
            <div>
              <dt>Heap Used</dt>
              <dd>{bytes(data.memory.heapUsedBytes)}</dd>
            </div>
            <div>
              <dt>Heap Total</dt>
              <dd>{bytes(data.memory.heapTotalBytes)}</dd>
            </div>
            <div>
              <dt>External</dt>
              <dd>{bytes(data.memory.externalBytes)}</dd>
            </div>
          </dl>
          <p>当前指标为单实例进程内统计；跨实例汇总需在生产阶段接入 Prometheus/OpenTelemetry。</p>
        </div>
      </section>
      <section className={styles.tablePanel}>
        <header>
          <h2>API 路由指标</h2>
          <span>采集开始 {dayjs(data.requests.startedAt).format('YYYY-MM-DD HH:mm:ss')}</span>
        </header>
        <Table
          rowKey={(row) => `${row.method}-${row.path}`}
          size="small"
          loading={loading}
          columns={routeColumns}
          dataSource={data.requests.routes}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 950 }}
        />
      </section>
    </PageContainer>
  );
}
