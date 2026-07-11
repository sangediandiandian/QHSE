import { ToolOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { Button, Result } from 'antd';

const titleByPath: Record<string, string> = {
  '/monitoring/gds': 'GDS 监测',
  '/monitoring/voc': 'VOC 监测',
  '/monitoring/mes': 'MES 数据关联',
  '/warnings': '综合预警中心',
};

export default function ModulePlaceholder() {
  const location = useLocation();
  const isEvent = location.pathname.startsWith('/warnings/');
  const title = isEvent ? '预警事件详情' : (titleByPath[location.pathname] ?? '业务模块');

  return (
    <PageContainer title={title}>
      <Result
        icon={<ToolOutlined style={{ color: '#1a7791' }} />}
        title={`${title}正在构建`}
        subTitle="驾驶舱的数据模型和路由入口已经就绪，该模块将在下一迭代接入同一套告警状态。"
        extra={
          <Button type="primary" onClick={() => history.push('/dashboard')}>
            返回综合驾驶舱
          </Button>
        }
      />
    </PageContainer>
  );
}
