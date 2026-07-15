export interface ReportRange {
  from: string;
  to: string;
  areaId?: string;
}

export interface ReportMetric {
  total: number;
  open: number;
  closed: number;
  rate: number;
  overdue?: number;
  critical?: number;
  active?: number;
}

export interface ReportTrendPoint {
  date: string;
  hazardCreated: number;
  hazardClosed: number;
  warningTriggered: number;
  emergencyCreated: number;
  emergencyClosed: number;
}

export interface ReportAreaRow {
  areaId: string;
  areaName: string;
  hazardTotal: number;
  hazardOpen: number;
  hazardOverdue: number;
  hazardClosureRate: number;
  warningTotal: number;
  warningCritical: number;
  permitTotal: number;
  permitActive: number;
  emergencyTotal: number;
  emergencyOpen: number;
  riskIndex: number;
}

export interface ReportSummary {
  range: ReportRange;
  generatedAt: string;
  hazards: ReportMetric;
  warnings: ReportMetric;
  permits: ReportMetric;
  emergencies: ReportMetric;
  trend: ReportTrendPoint[];
  areas: ReportAreaRow[];
}
