import { getHazardRiskUnits } from './hazards';
import { getTelemetryPoints, toGdsPoint } from './telemetry';
import { getWorkPermits } from './workPermits';
import { getWarningRules, getWarningSignals } from './warningRules';

export async function getWorkPermitLinkageSnapshot() {
  const [permits, risks, gds, rules, signals] = await Promise.all([
    getWorkPermits(),
    getHazardRiskUnits(),
    getTelemetryPoints('GDS'),
    getWarningRules(),
    getWarningSignals(),
  ]);

  return {
    permits,
    areas: Array.from(
      new Map(
        risks.map((risk) => [
          risk.areaId,
          {
            id: risk.areaId,
            name: risk.areaName,
          },
        ]),
      ).values(),
    ),
    gdsPoints: gds.map(toGdsPoint),
    rules,
    signals,
  };
}
