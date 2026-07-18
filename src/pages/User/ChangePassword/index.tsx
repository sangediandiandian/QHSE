import { Footer } from '@/components';
import { changePassword } from '@/services/ant-design-pro/api';
import { LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { ProForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, history } from '@umijs/max';
import { Alert, Card, message } from 'antd';
import { createStyles } from 'antd-style';
import Settings from '../../../../config/defaultSettings';

const useStyles = createStyles(({ token }) => ({
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #edf4f6 0%, #dbe9ed 100%)',
  },
  main: {
    flex: 1,
    display: 'grid',
    placeItems: 'center',
    padding: 24,
  },
  card: {
    width: 'min(520px, 100%)',
    boxShadow: token.boxShadowSecondary,
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    fontSize: 24,
    fontWeight: 600,
    color: token.colorPrimary,
  },
}));

export default function ChangePassword() {
  const { styles } = useStyles();

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{`设置新密码${Settings.title ? ` - ${Settings.title}` : ''}`}</title>
      </Helmet>
      <main className={styles.main}>
        <Card className={styles.card}>
          <div className={styles.title}>
            <SafetyCertificateOutlined />
            设置新密码
          </div>
          <Alert
            type="warning"
            showIcon
            message="首次登录或管理员重置密码后，必须设置仅本人知晓的新密码才能进入系统。"
            style={{ marginBottom: 24 }}
          />
          <ProForm
            submitter={{ searchConfig: { submitText: '确认修改' }, resetButtonProps: false }}
            onFinish={async (values) => {
              await changePassword({
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
              });
              localStorage.removeItem('qhse_access_token');
              message.success('密码修改成功，请使用新密码重新登录');
              history.replace('/user/login');
              return true;
            }}
          >
            <ProFormText.Password
              name="currentPassword"
              label="当前密码"
              fieldProps={{ prefix: <LockOutlined />, autoComplete: 'current-password' }}
              rules={[{ required: true, message: '请输入当前密码' }]}
            />
            <ProFormText.Password
              name="newPassword"
              label="新密码"
              fieldProps={{ prefix: <LockOutlined />, autoComplete: 'new-password' }}
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 8, max: 72, message: '密码长度为 8–72 位' },
              ]}
            />
            <ProFormText.Password
              name="confirmPassword"
              label="确认新密码"
              dependencies={['newPassword']}
              fieldProps={{ prefix: <LockOutlined />, autoComplete: 'new-password' }}
              rules={[
                { required: true, message: '请再次输入新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    return value === getFieldValue('newPassword')
                      ? Promise.resolve()
                      : Promise.reject(new Error('两次输入的新密码不一致'));
                  },
                }),
              ]}
            />
          </ProForm>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
