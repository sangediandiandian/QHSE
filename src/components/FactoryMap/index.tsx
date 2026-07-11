import type { PlantArea, RiskLevel } from '@/types/qhse';
import { EnvironmentFilled } from '@ant-design/icons';
import styles from './index.less';

const riskText: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '一般风险',
  high: '较大风险',
  critical: '重大风险',
};

interface FactoryMapProps {
  areas: PlantArea[];
  selectedId?: string;
  onSelect: (area: PlantArea) => void;
}

export default function FactoryMap({ areas, selectedId, onSelect }: FactoryMapProps) {
  return (
    <div className={styles.map} aria-label="厂区装置风险分布图">
      <div className={styles.grid} />
      <svg className={styles.pipes} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path d="M18 42 V49 H49 V56 M50 41 V49 H80 V55 M29 70 H37 M61 70 H70" />
        <path className={styles.secondaryPipe} d="M30 26 H38 M62 25 H70" />
      </svg>
      <div className={styles.compass}>
        <span>北</span>
        <i />
      </div>
      {areas.map((area) => (
        <button
          type="button"
          key={area.id}
          className={`${styles.area} ${styles[area.riskLevel]} ${selectedId === area.id ? styles.selected : ''}`}
          style={{
            left: `${area.x}%`,
            top: `${area.y}%`,
            width: `${area.width}%`,
            height: `${area.height}%`,
          }}
          onClick={() => onSelect(area)}
          aria-label={`${area.name}，${riskText[area.riskLevel]}`}
        >
          <span className={styles.areaCode}>{area.code}</span>
          <strong>{area.shortName}</strong>
          <span className={styles.areaStatus}>
            <i />
            {area.status === 'normal'
              ? '运行平稳'
              : area.status === 'warning'
                ? '重点监控'
                : '存在告警'}
          </span>
          {area.status === 'alarm' && <EnvironmentFilled className={styles.alarmPin} />}
        </button>
      ))}
      <div className={styles.legend}>
        {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((level) => (
          <span key={level}>
            <i className={styles[level]} />
            {riskText[level]}
          </span>
        ))}
      </div>
    </div>
  );
}
