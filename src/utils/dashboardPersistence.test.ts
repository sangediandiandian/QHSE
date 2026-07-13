import type { DashboardData } from '@/types/qhse';
import {
  DASHBOARD_STORAGE_KEY,
  clearPersistedDashboard,
  loadPersistedDashboard,
  persistDashboard,
} from './dashboardPersistence';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const dashboard = {
  alarms: [], warningRules: [], hazards: [], workPermits: [], emergencyEvents: [],
} as unknown as DashboardData;

describe('dashboard persistence', () => {
  it('保存并恢复版本化演示状态', () => {
    const storage = createStorage();
    expect(persistDashboard(storage, dashboard)).toBe(true);
    expect(loadPersistedDashboard(storage)).toEqual(dashboard);
  });

  it('忽略损坏或旧版本数据', () => {
    const storage = createStorage();
    storage.setItem(DASHBOARD_STORAGE_KEY, '{broken');
    expect(loadPersistedDashboard(storage)).toBeUndefined();
    storage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify({ version: 2, data: dashboard }));
    expect(loadPersistedDashboard(storage)).toBeUndefined();
  });

  it('可以清除已保存状态', () => {
    const storage = createStorage();
    persistDashboard(storage, dashboard);
    clearPersistedDashboard(storage);
    expect(loadPersistedDashboard(storage)).toBeUndefined();
  });
});
