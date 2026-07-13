import type { DashboardData } from '@/types/qhse';

export const DASHBOARD_STORAGE_KEY = 'qhse.dashboard.v1';

interface StorageReader {
  getItem: (key: string) => string | null;
}

interface StorageWriter extends StorageReader {
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function isDashboardData(value: unknown): value is DashboardData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DashboardData>;
  return Array.isArray(candidate.alarms)
    && Array.isArray(candidate.warningRules)
    && Array.isArray(candidate.hazards)
    && Array.isArray(candidate.workPermits);
}

export function loadPersistedDashboard(storage: StorageReader) {
  try {
    const value = storage.getItem(DASHBOARD_STORAGE_KEY);
    if (!value) return undefined;
    const parsed = JSON.parse(value) as { version?: number; data?: unknown };
    return parsed.version === 1 && isDashboardData(parsed.data) ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function persistDashboard(storage: StorageWriter, dashboard: DashboardData) {
  try {
    storage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify({ version: 1, data: dashboard }));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedDashboard(storage: StorageWriter) {
  storage.removeItem(DASHBOARD_STORAGE_KEY);
}
