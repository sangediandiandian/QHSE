import { TestBrowser } from '@@/testBrowser';
import { fireEvent, render, waitFor } from '@testing-library/react';
import React, { act } from 'react';

// @ts-ignore
import { startMock } from '@@/requestRecordMock';

let server: {
  close: () => void;
};

describe('Login Page', () => {
  beforeAll(async () => {
    server = await startMock({
      port: 8000,
      scene: 'login',
    });
  });

  afterAll(() => {
    server?.close();
  });

  it('should show login form', async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{
          pathname: '/user/login',
        }}
      />,
    );

    await rootContainer.findAllByText('Ant Design');

    act(() => {
      historyRef.current?.push('/user/login');
    });

    expect(rootContainer.baseElement?.querySelector('.ant-pro-form-login-desc')?.textContent).toBe(
      '风险监测预警与应急联动平台',
    );

    expect(rootContainer.asFragment()).toMatchSnapshot();

    rootContainer.unmount();
  });

  it('should login success', async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{
          pathname: '/user/login',
        }}
      />,
    );

    await rootContainer.findAllByText('Ant Design');

    const userNameInput = await rootContainer.findByPlaceholderText('Username: admin or user');

    act(() => {
      fireEvent.change(userNameInput, { target: { value: 'admin' } });
    });

    const passwordInput = await rootContainer.findByPlaceholderText('Password: ant.design');

    act(() => {
      fireEvent.change(passwordInput, { target: { value: 'ant.design' } });
    });

    await (await rootContainer.findByText('Login')).click();

    await waitFor(
      () => {
        expect(historyRef.current?.location.pathname).toBe('/dashboard');
      },
      { timeout: 7000 },
    );
    expect(await rootContainer.findAllByText('炼化 QHSE')).not.toHaveLength(0);
    fireEvent.click(await rootContainer.findByText('QHSE 管理'));
    expect(await rootContainer.findByText('风险分级')).toBeTruthy();
    expect(await rootContainer.findByText('隐患治理')).toBeTruthy();
    expect(await rootContainer.findByText('作业许可')).toBeTruthy();
    expect(await rootContainer.findAllByText('监测中心')).not.toHaveLength(0);

    rootContainer.unmount();
  });
});
