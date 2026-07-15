import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EmergencyEventService } from '../emergency-events/emergency-event.service';
import type { EmergencyEvent } from '../emergency-events/emergency-event.types';
import type { HazardService } from '../hazards/hazard.service';
import type { Hazard } from '../hazards/hazard.types';
import type { WarningExecutionService } from '../warning-execution/warning-execution.service';
import type { WarningSignal } from '../warning-execution/warning-execution.types';
import type { WorkPermitService } from '../work-permits/work-permit.service';
import type { WorkPermit } from '../work-permits/work-permit.types';
import type { ReportQueryDto } from './report-query.dto';
import type {
  ReportAreaRow,
  ReportMetric,
  ReportRange,
  ReportSummary,
  ReportTrendPoint,
} from './reporting.types';

const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNAL_REPORT_LIMIT = 10_000;

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const rate = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const csvRow = (values: Array<string | number>) =>
  values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
const inRange = (timestamp: string, range: ReportRange) => {
  const value = timestamp.slice(0, 10);
  return value >= range.from && value <= range.to;
};

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && dateOnly(date) === value ? date : undefined;
}

function dates(from: string, to: string) {
  const result: string[] = [];
  for (
    let time = new Date(`${from}T00:00:00Z`).getTime();
    time <= new Date(`${to}T00:00:00Z`).getTime();
    time += DAY_MS
  ) {
    result.push(dateOnly(new Date(time)));
  }
  return result;
}

function increment(
  points: Map<string, ReportTrendPoint>,
  timestamp: string,
  key: Exclude<keyof ReportTrendPoint, 'date'>,
) {
  const point = points.get(timestamp.slice(0, 10));
  if (point) point[key] += 1;
}

function hazardMetric(items: Hazard[]): ReportMetric {
  const closed = items.filter((item) => item.status === '已关闭').length;
  return {
    total: items.length,
    open: items.length - closed,
    closed,
    overdue: items.filter((item) => item.overdue && item.status !== '已关闭').length,
    rate: rate(closed, items.length),
  };
}

function warningMetric(items: WarningSignal[]): ReportMetric {
  const active = items.filter((item) => item.status === 'active').length;
  return {
    total: items.length,
    open: active,
    closed: items.length - active,
    active,
    critical: items.filter((item) => item.level === 'critical').length,
    rate: rate(items.length - active, items.length),
  };
}

function permitMetric(items: WorkPermit[]): ReportMetric {
  const closed = items.filter((item) => item.status === '已关闭').length;
  const active = items.filter((item) =>
    ['作业中', '建议暂停', '已暂停'].includes(item.status),
  ).length;
  return { total: items.length, open: active, closed, active, rate: rate(closed, items.length) };
}

function emergencyMetric(items: EmergencyEvent[]): ReportMetric {
  const closed = items.filter((item) => item.status === '已关闭').length;
  return {
    total: items.length,
    open: items.length - closed,
    closed,
    rate: rate(closed, items.length),
  };
}

function trend(
  range: ReportRange,
  hazards: Hazard[],
  signals: WarningSignal[],
  emergencies: EmergencyEvent[],
) {
  const points = new Map<string, ReportTrendPoint>();
  for (const date of dates(range.from, range.to)) {
    points.set(date, {
      date,
      hazardCreated: 0,
      hazardClosed: 0,
      warningTriggered: 0,
      emergencyCreated: 0,
      emergencyClosed: 0,
    });
  }
  for (const item of hazards.filter((value) => !range.areaId || value.areaId === range.areaId)) {
    increment(points, item.createdAt, 'hazardCreated');
    for (const operation of item.operations.filter((value) => value.action === '验收关闭')) {
      increment(points, operation.operatedAt, 'hazardClosed');
    }
  }
  for (const item of signals.filter((value) => !range.areaId || value.areaId === range.areaId)) {
    increment(points, item.occurredAt, 'warningTriggered');
  }
  for (const item of emergencies.filter(
    (value) => !range.areaId || value.areaId === range.areaId,
  )) {
    increment(points, item.createdAt, 'emergencyCreated');
    for (const operation of item.operations.filter((value) => value.action === '审批关闭')) {
      increment(points, operation.operatedAt, 'emergencyClosed');
    }
  }
  return [...points.values()];
}

function areaRows(
  hazards: Hazard[],
  permits: WorkPermit[],
  warnings: WarningSignal[],
  emergencies: EmergencyEvent[],
) {
  const areas = new Map<string, ReportAreaRow>();
  const ensure = (areaId: string, areaName = areaId) => {
    const current = areas.get(areaId);
    if (current) {
      if (current.areaName === areaId && areaName !== areaId) current.areaName = areaName;
      return current;
    }
    const row: ReportAreaRow = {
      areaId,
      areaName,
      hazardTotal: 0,
      hazardOpen: 0,
      hazardOverdue: 0,
      hazardClosureRate: 0,
      warningTotal: 0,
      warningCritical: 0,
      permitTotal: 0,
      permitActive: 0,
      emergencyTotal: 0,
      emergencyOpen: 0,
      riskIndex: 0,
    };
    areas.set(areaId, row);
    return row;
  };
  for (const item of hazards) {
    const row = ensure(item.areaId, item.areaName);
    row.hazardTotal += 1;
    if (item.status !== '已关闭') row.hazardOpen += 1;
    if (item.overdue && item.status !== '已关闭') row.hazardOverdue += 1;
  }
  for (const item of permits) {
    const row = ensure(item.areaId, item.areaName);
    row.permitTotal += 1;
    if (['作业中', '建议暂停', '已暂停'].includes(item.status)) row.permitActive += 1;
  }
  for (const item of warnings) {
    if (!item.areaId) continue;
    const row = ensure(item.areaId);
    row.warningTotal += 1;
    if (item.level === 'critical') row.warningCritical += 1;
  }
  for (const item of emergencies) {
    const row = ensure(item.areaId, item.areaName);
    row.emergencyTotal += 1;
    if (item.status !== '已关闭') row.emergencyOpen += 1;
  }
  for (const row of areas.values()) {
    row.hazardClosureRate = rate(row.hazardTotal - row.hazardOpen, row.hazardTotal);
    row.riskIndex =
      row.hazardOpen * 2 +
      row.hazardOverdue * 3 +
      row.warningTotal * 2 +
      row.warningCritical * 5 +
      row.permitActive +
      row.emergencyOpen * 4;
  }
  return [...areas.values()].sort(
    (a, b) => b.riskIndex - a.riskIndex || a.areaId.localeCompare(b.areaId),
  );
}

export class ReportingService {
  constructor(
    private readonly hazards: HazardService,
    private readonly permits: WorkPermitService,
    private readonly warnings: WarningExecutionService,
    private readonly emergencies: EmergencyEventService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async summary(query: ReportQueryDto, allowedAreaIds?: string[]): Promise<ReportSummary> {
    const range = this.range(query, allowedAreaIds);
    const [hazards, permits, signals, emergencies] = await Promise.all([
      this.hazards.list({}, allowedAreaIds),
      this.permits.list({}, allowedAreaIds),
      this.warnings.listSignals(SIGNAL_REPORT_LIMIT + 1),
      this.emergencies.list({}, allowedAreaIds),
    ]);
    if (signals.length > SIGNAL_REPORT_LIMIT) {
      throw new BadRequestException({
        code: 'REPORT_DATA_LIMIT_EXCEEDED',
        message: '预警数据量超过单次统计上限，请缩小统计范围',
      });
    }
    const visibleHazards = hazards.filter((item) =>
      this.inArea(item.areaId, range, allowedAreaIds),
    );
    const visiblePermits = permits.filter((item) =>
      this.inArea(item.areaId, range, allowedAreaIds),
    );
    const visibleSignals = signals.filter((item) =>
      this.inArea(item.areaId, range, allowedAreaIds),
    );
    const visibleEmergencies = emergencies.filter((item) =>
      this.inArea(item.areaId, range, allowedAreaIds),
    );
    const selectedHazards = visibleHazards.filter((item) => inRange(item.createdAt, range));
    const selectedPermits = visiblePermits.filter((item) => inRange(item.createdAt, range));
    const selectedSignals = visibleSignals.filter((item) => inRange(item.occurredAt, range));
    const selectedEmergencies = visibleEmergencies.filter((item) => inRange(item.createdAt, range));
    return {
      range,
      generatedAt: this.now().toISOString(),
      hazards: hazardMetric(selectedHazards),
      warnings: warningMetric(selectedSignals),
      permits: permitMetric(selectedPermits),
      emergencies: emergencyMetric(selectedEmergencies),
      trend: trend(range, visibleHazards, visibleSignals, visibleEmergencies),
      areas: areaRows(selectedHazards, selectedPermits, selectedSignals, selectedEmergencies),
    };
  }

  async csv(query: ReportQueryDto, allowedAreaIds?: string[]) {
    const report = await this.summary(query, allowedAreaIds);
    const header = [
      '统计开始',
      '统计结束',
      '区域编码',
      '区域名称',
      '隐患总数',
      '未闭环隐患',
      '逾期隐患',
      '隐患闭环率(%)',
      '预警总数',
      '重大预警',
      '作业票总数',
      '活动作业票',
      '应急事件总数',
      '未关闭事件',
      '风险指数',
    ];
    const rows = report.areas.map((item) => [
      report.range.from,
      report.range.to,
      item.areaId,
      item.areaName,
      item.hazardTotal,
      item.hazardOpen,
      item.hazardOverdue,
      item.hazardClosureRate,
      item.warningTotal,
      item.warningCritical,
      item.permitTotal,
      item.permitActive,
      item.emergencyTotal,
      item.emergencyOpen,
      item.riskIndex,
    ]);
    return Buffer.from(`\uFEFF${[header, ...rows].map(csvRow).join('\r\n')}\r\n`, 'utf8');
  }

  private range(query: ReportQueryDto, allowedAreaIds?: string[]): ReportRange {
    const today = dateOnly(this.now());
    const to = query.to ?? today;
    const from =
      query.from ?? dateOnly(new Date(new Date(`${to}T00:00:00Z`).getTime() - 29 * DAY_MS));
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    if (
      !fromDate ||
      !toDate ||
      from > to ||
      to > today ||
      toDate.getTime() - fromDate.getTime() > 365 * DAY_MS
    ) {
      throw new BadRequestException({
        code: 'REPORT_RANGE_INVALID',
        message: '统计日期无效，且时间范围不能超过 366 天',
      });
    }
    if (query.areaId && allowedAreaIds && !allowedAreaIds.includes(query.areaId)) {
      throw new NotFoundException({ code: 'REPORT_AREA_NOT_FOUND', message: '统计区域不存在' });
    }
    return { from, to, areaId: query.areaId };
  }

  private inArea(areaId: string | undefined, range: ReportRange, allowedAreaIds?: string[]) {
    if (allowedAreaIds && (!areaId || !allowedAreaIds.includes(areaId))) return false;
    return !range.areaId || areaId === range.areaId;
  }
}
