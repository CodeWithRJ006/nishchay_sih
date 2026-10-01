

export type InstrumentClass = 'Weights' | 'Length measure' | 'Capacity measure' | 'Counter machine' | 'NAWI class III up to 150 kg';
export type RoutingRole = 'LMO' | 'GATC';

export type InstrumentRule = {
  code: string;
  label: InstrumentClass;
  validityMonths: number;
  routing: RoutingRole;
  baseFeeDemo: number;
  tolerancesDemo: number;
  sourceNote: string;
  verified: boolean;
};

export const INSTRUMENT_RULES: InstrumentRule[] = [
  { code: 'W-1', label: 'Weights', validityMonths: 24, routing: 'LMO', baseFeeDemo: 100, tolerancesDemo: 5, sourceNote: 'Assumed validity of 24 months based on general practices.', verified: false },
  { code: 'L-1', label: 'Length measure', validityMonths: 24, routing: 'LMO', baseFeeDemo: 100, tolerancesDemo: 2, sourceNote: 'Assumed validity of 24 months.', verified: false },
  { code: 'C-1', label: 'Capacity measure', validityMonths: 12, routing: 'LMO', baseFeeDemo: 150, tolerancesDemo: 10, sourceNote: 'Assumed validity of 12 months.', verified: false },
  { code: 'CM-1', label: 'Counter machine', validityMonths: 12, routing: 'LMO', baseFeeDemo: 200, tolerancesDemo: 20, sourceNote: 'Assumed validity of 12 months.', verified: false },
  { code: 'NAWI-3', label: 'NAWI class III up to 150 kg', validityMonths: 12, routing: 'GATC', baseFeeDemo: 500, tolerancesDemo: 50, sourceNote: 'GATC routed per PLAN.md.', verified: false },
];

export function computeValidTo(validFromDate: Date, validityMonths: number): Date {
  const d = new Date(validFromDate);
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + validityMonths);
  if (d.getDate() !== originalDay) {
    d.setDate(0);
  }
  return d;
}

export function computeFee(instrumentCode: string): number {
  const rule = INSTRUMENT_RULES.find(r => r.code === instrumentCode);
  if (!rule) throw new Error(`Unknown instrument code: ${instrumentCode}`);
  return rule.baseFeeDemo;
}

export function requiresGatc(instrumentCode: string): boolean {
  const rule = INSTRUMENT_RULES.find(r => r.code === instrumentCode);
  if (!rule) throw new Error(`Unknown instrument code: ${instrumentCode}`);
  return rule.routing === 'GATC';
}

export type Reading = {
  applied: number;
  observed: number;
};

export function evaluateReadings(instrumentCode: string, readings: Reading[]): { pass: boolean; reasons: string[] } {
  const rule = INSTRUMENT_RULES.find(r => r.code === instrumentCode);
  if (!rule) throw new Error(`Unknown instrument code: ${instrumentCode}`);
  
  const reasons: string[] = [];
  let pass = true;

  readings.forEach((r, i) => {
    const error = Math.abs(r.applied - r.observed);
    if (error > rule.tolerancesDemo) {
      pass = false;
      reasons.push(`Reading ${i + 1}: Error of ${error} exceeds tolerance of ${rule.tolerancesDemo}`);
    }
  });

  return { pass, reasons };
}
