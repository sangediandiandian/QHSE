import type { CommunicationService } from '../communications/communication.service';
import type { EmergencyEventService } from '../emergency-events/emergency-event.service';
import type { EmergencyEvent } from '../emergency-events/emergency-event.types';
import type { EmergencyResourceService } from '../emergency-resources/emergency-resource.service';
import type { IamService } from '../iam/iam.service';
import type { RiskService } from '../risks/risk.service';
import type { RiskLevel } from '../risks/risk.types';
import type { TelemetryService } from '../telemetry/telemetry.service';
import type { TelemetryPoint } from '../telemetry/telemetry.types';
import type { WarningExecutionService } from '../warning-execution/warning-execution.service';
import type { WarningSignal } from '../warning-execution/warning-execution.types';

const levelRank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const riskText = {
  low: '低风险',
  medium: '一般风险',
  high: '较大风险',
  critical: '重大风险',
} as const;
const areaPositions = [
  { x: 8, y: 12 },
  { x: 38, y: 12 },
  { x: 68, y: 12 },
  { x: 8, y: 55 },
  { x: 38, y: 55 },
  { x: 68, y: 55 },
];

type AlarmSource = 'GDS' | 'VOC' | 'MES' | '联合预警' | '作业许可';

function numberValue(value: string | number | boolean | undefined, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function percentage(numerator: number, denominator: number, emptyValue = 0) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : emptyValue;
}

function highestLevel(levels: RiskLevel[]) {
  return levels.reduce<RiskLevel>(
    (highest, level) => (levelRank[level] > levelRank[highest] ? level : highest),
    'low',
  );
}

function sourceOf(value: string): AlarmSource {
  return ['GDS', 'VOC', 'MES', '联合预警', '作业许可'].includes(value)
    ? (value as AlarmSource)
    : '联合预警';
}

function telemetryLevel(point: TelemetryPoint): RiskLevel {
  if (point.onlineStatus !== 'online') return 'low';
  if (point.source === 'GDS') {
    if (point.status === 'level2') return 'critical';
    if (point.status === 'level1') return 'high';
    return 'medium';
  }
  if (point.source === 'VOC') return point.status === 'exceeded' ? 'high' : 'medium';
  return point.status === 'alarm' ? 'high' : 'medium';
}

function isAbnormal(point: TelemetryPoint) {
  return point.onlineStatus !== 'online' || point.status !== 'normal';
}

function mapSignal(signal: WarningSignal, areaNames: Map<string, string>) {
  return {
    id: signal.id,
    code: signal.code,
    title: signal.title,
    source: sourceOf(signal.source),
    areaId: signal.areaId ?? '',
    areaName: signal.areaId ? (areaNames.get(signal.areaId) ?? '未分配区域') : '企业级',
    level: signal.level,
    value: signal.detail,
    occurredAt: signal.occurredAt,
    status: '待确认' as const,
  };
}

function mapTelemetryAlarm(point: TelemetryPoint) {
  const current = numberValue(point.currentMetrics[point.metricKey]);
  return {
    id: `telemetry-${point.id}`,
    code: `TEL-${point.code}`,
    title: `${point.name}${point.onlineStatus === 'online' ? '指标异常' : '通信异常'}`,
    source: point.source,
    areaId: point.areaId,
    areaName: point.areaName,
    level: telemetryLevel(point),
    value: `${current} ${point.unit}`,
    occurredAt: point.lastSampleAt ?? point.updatedAt,
    status: '监控中' as const,
  };
}

function flatTrend(value: number) {
  return Array.from({ length: 6 }, () => value);
}

function mean(points: TelemetryPoint[]) {
  if (!points.length) return 0;
  return (
    Math.round(
      (points.reduce((sum, point) => sum + numberValue(point.currentMetrics[point.metricKey]), 0) /
        points.length) *
        10,
    ) / 10
  );
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export class DashboardService {
  constructor(
    private readonly telemetry: TelemetryService,
    private readonly risks: RiskService,
    private readonly warnings: WarningExecutionService,
    private readonly communications: CommunicationService,
    private readonly resources: EmergencyResourceService,
    private readonly emergencies: EmergencyEventService,
    private readonly iam: IamService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async snapshot(allowedAreaIds?: string[]) {
    const [rawPoints, rawRiskUnits, signals, dispatches, emergencyResources, rawEmergencyEvents] =
      await Promise.all([
        this.telemetry.listPoints({}, allowedAreaIds),
        this.risks.list({}, allowedAreaIds),
        this.warnings.listSignals(100),
        this.communications.list(),
        this.resources.list(),
        this.emergencies.list({}, allowedAreaIds),
      ]);
    const allowed = allowedAreaIds ? new Set(allowedAreaIds) : undefined;
    const points = rawPoints.filter((point) => !allowed || allowed.has(point.areaId));
    const riskUnits = rawRiskUnits.filter((risk) => !allowed || allowed.has(risk.areaId));
    const emergencyEvents = rawEmergencyEvents.filter(
      (event) => !allowed || allowed.has(event.areaId),
    );
    const areaCatalog = this.iam
      .listOrganizations()
      .flatMap((organization) => organization.areas)
      .filter((area) => !allowed || allowed.has(area.id));
    const areaNames = new Map(areaCatalog.map((area) => [area.id, area.name]));
    const scopedSignals = signals.filter(
      (signal) =>
        signal.status === 'active' && (!allowed || (signal.areaId && allowed.has(signal.areaId))),
    );
    const scopedDispatches = dispatches.filter(
      (dispatch) => !allowed || [...areaNames.values()].includes(dispatch.areaName),
    );
    const signaledSubjects = new Set(scopedSignals.map((signal) => signal.subjectId));
    const alarms = [
      ...scopedSignals.map((signal) => mapSignal(signal, areaNames)),
      ...points
        .filter((point) => isAbnormal(point) && !signaledSubjects.has(point.id))
        .map(mapTelemetryAlarm),
    ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    const areas = areaCatalog.map((area, index) => {
      const areaRisks = riskUnits.filter((risk) => risk.areaId === area.id);
      const riskLevel = highestLevel(areaRisks.map((risk) => risk.currentLevel));
      const areaAlarms = alarms.filter((alarm) => alarm.areaId === area.id);
      const status = areaAlarms.some((alarm) => levelRank[alarm.level] >= levelRank.high)
        ? 'alarm'
        : areaAlarms.length || levelRank[riskLevel] >= levelRank.high
          ? 'warning'
          : 'normal';
      return {
        ...area,
        shortName: area.name.replace(/装置$/, ''),
        riskLevel,
        status,
        ...(areaPositions[index] ?? areaPositions[index % areaPositions.length]),
        width: 25,
        height: 25,
      };
    });
    const gdsPoints = points
      .filter((point) => point.source === 'GDS')
      .map((point) => ({
        id: point.id,
        code: point.code,
        name: point.name,
        areaId: point.areaId,
        areaName: point.areaName,
        equipmentName: point.equipmentName,
        gasType: ['可燃气体', '硫化氢', '氧气'].includes(String(point.configuration.gasType))
          ? point.configuration.gasType
          : '可燃气体',
        currentValue: numberValue(point.currentMetrics[point.metricKey]),
        unit: point.unit,
        alarmLevel1: numberValue(point.configuration.alarmLevel1),
        alarmLevel2: numberValue(point.configuration.alarmLevel2),
        onlineStatus: point.onlineStatus,
        alarmStatus: point.onlineStatus === 'online' ? point.status : 'normal',
        trend: flatTrend(numberValue(point.currentMetrics[point.metricKey])),
      }));
    const vocPoints = points
      .filter((point) => point.source === 'VOC')
      .map((point) => ({
        id: point.id,
        code: point.code,
        name: point.name,
        pointType: point.configuration.pointType ?? '有组织排口',
        areaId: point.areaId,
        areaName: point.areaName,
        pollutantType: point.configuration.pollutantType ?? '非甲烷总烃',
        currentValue: numberValue(point.currentMetrics[point.metricKey]),
        limitValue: numberValue(point.configuration.limitValue),
        flowValue: numberValue(point.currentMetrics.flow),
        status: point.onlineStatus === 'online' ? point.status : 'offline',
        trend: flatTrend(numberValue(point.currentMetrics[point.metricKey])),
      }));
    const mesTags = points
      .filter((point) => point.source === 'MES')
      .map((point) => ({
        id: point.id,
        code: point.code,
        name: point.name,
        unitId: point.areaId,
        unitName: point.areaName,
        equipmentName: point.equipmentName,
        processStep: point.configuration.processStep ?? '进料',
        parameterType: point.configuration.parameterType ?? '压力',
        currentValue: numberValue(point.currentMetrics[point.metricKey]),
        unit: point.unit,
        upperLimit: numberValue(point.configuration.upperLimit),
        lowerLimit: numberValue(point.configuration.lowerLimit),
        status: point.onlineStatus === 'online' ? point.status : 'offline',
        trend: flatTrend(numberValue(point.currentMetrics[point.metricKey])),
      }));
    const communicationTasks = scopedDispatches.flatMap((dispatch) => dispatch.tasks);
    const activeEvent = this.activeEvent(emergencyEvents);
    const timestamp = this.now();
    const sourcePoints = {
      GDS: points.filter((point) => point.source === 'GDS'),
      VOC: points.filter((point) => point.source === 'VOC'),
      MES: points.filter((point) => point.source === 'MES'),
    };
    const highest = highestLevel(areas.map((area) => area.riskLevel));
    const onlineVoc = sourcePoints.VOC.filter((point) => point.onlineStatus === 'online');
    return {
      updatedAt: timestamp.toISOString(),
      metrics: {
        overallRisk: riskText[highest],
        onlineUnits: areas.filter((area) => area.status !== 'alarm').length,
        gdsOnlineRate: percentage(
          sourcePoints.GDS.filter((point) => point.onlineStatus === 'online').length,
          sourcePoints.GDS.length,
        ),
        activeAlarms: alarms.length,
        vocComplianceRate: percentage(
          onlineVoc.filter((point) => point.status !== 'exceeded').length,
          onlineVoc.length,
        ),
        mesAnomalies: sourcePoints.MES.filter((point) => isAbnormal(point)).length,
        pendingWarnings: alarms.filter((alarm) => alarm.status === '待确认').length,
        highRiskPermits: 0,
        deliveryRate: percentage(
          communicationTasks.filter((task) => task.deliveryStatus === '已送达').length,
          communicationTasks.length,
          100,
        ),
      },
      areas,
      alarms,
      trend: Array.from({ length: 6 }, (_, index) => ({
        label: formatTime(new Date(timestamp.getTime() - (5 - index) * 10 * 60_000)),
        gds: mean(sourcePoints.GDS),
        voc: mean(sourcePoints.VOC),
        mes: mean(sourcePoints.MES),
      })),
      gdsPoints,
      vocPoints,
      vocFacilities: [],
      mesTags,
      mesUnits: [],
      communicationTasks,
      emergencyPlan: this.emergencyPlan(activeEvent),
      emergencyPlans: [],
      emergencyTasks: this.emergencyTasks(activeEvent),
      emergencyResources,
      eventReviews: [],
      riskUnits,
      hazards: [],
      workPermits: [],
      warningRules: [],
      emergencyEvents,
    };
  }

  private activeEvent(events: EmergencyEvent[]) {
    return events
      .filter((event) => event.status !== '已关闭')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  private emergencyPlan(event?: EmergencyEvent) {
    if (!event)
      return {
        id: 'none',
        code: 'NONE',
        name: '当前无启动预案',
        eventId: 'none',
        responseLevel: 'IV级',
        matchScore: 0,
        matchReason: '无活动应急事件',
        commander: '待命',
        assemblyPoint: '按事件指定',
        status: '推荐',
      };
    return {
      id: `plan-${event.id}`,
      code: `PLAN-${event.code}`,
      name: `${event.title}现场处置方案`,
      eventId: event.eventId,
      responseLevel: event.responseLevel,
      matchScore: 100,
      matchReason: `依据 ${event.source} 事件自动关联`,
      commander: event.commander,
      assemblyPoint: `${event.areaName}应急集合点`,
      status: event.status === '已关闭' ? '已终止' : '已启动',
    };
  }

  private emergencyTasks(event?: EmergencyEvent) {
    if (!event) return [];
    return event.operations.map((operation, index) => ({
      id: operation.id,
      eventId: event.eventId,
      name: operation.detail,
      department: event.ownerDepartment,
      owner: operation.operator,
      deadline: operation.operatedAt,
      status:
        index === event.operations.length - 1 && event.status !== '已关闭' ? '执行中' : '已完成',
      feedback: operation.action,
    }));
  }
}
