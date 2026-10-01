import { describe, it, expect } from 'vitest';
import { canonicalJson } from '../src/canonicalJson.js';
import { transition } from '../src/stateMachine.js';
import { computeValidTo } from '../src/rules.js';

describe('canonicalJson', () => {
  it('gives the same output for any key order', () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };
    expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
  });
  it('rejects undefined, NaN, Infinity', () => {
    expect(() => canonicalJson({ a: undefined })).not.toThrow();
    expect(() => canonicalJson(undefined)).toThrow();
    expect(() => canonicalJson(NaN)).toThrow();
    expect(() => canonicalJson(Infinity)).toThrow();
  });
});

describe('State Machine exhaustive transitions', () => {
  it('allows declared transitions', () => {
    expect(transition('DRAFT', { type: 'submit' })).toBe('SUBMITTED');
    expect(transition('SUBMITTED', { type: 'payment_succeeded' })).toBe('PAID');
    expect(transition('SUBMITTED', { type: 'cancel' })).toBe('CANCELLED');
    expect(transition('PAID', { type: 'schedule' })).toBe('SCHEDULED');
    expect(transition('SCHEDULED', { type: 'officer_accept' })).toBe('ACCEPTED');
    expect(transition('SCHEDULED', { type: 'officer_reject', reason: 'busy' })).toBe('PAID');
    expect(transition('ACCEPTED', { type: 'inspection_pass' })).toBe('INSPECTED_PASS');
    expect(transition('ACCEPTED', { type: 'inspection_fail', reasons: [] })).toBe('FAILED');
    expect(transition('INSPECTED_PASS', { type: 'issue_certificate' })).toBe('CERTIFIED');
  });

  it('rejects unlisted transitions', () => {
    expect(() => transition('DRAFT', { type: 'payment_succeeded' })).toThrow();
    expect(() => transition('CERTIFIED', { type: 'submit' })).toThrow();
  });

  it('allows admin_cancel before ACCEPTED', () => {
    expect(transition('DRAFT', { type: 'admin_cancel' })).toBe('CANCELLED');
    expect(transition('SCHEDULED', { type: 'admin_cancel' })).toBe('CANCELLED');
    expect(() => transition('ACCEPTED', { type: 'admin_cancel' })).toThrow();
  });
});

describe('computeValidTo', () => {
  it('handles regular month additions', () => {
    const d = computeValidTo(new Date('2026-01-15T00:00:00Z'), 12);
    expect(d.toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('handles end of month (31 Jan + 24 months = 31 Jan)', () => {
    const d = computeValidTo(new Date('2026-01-31T00:00:00Z'), 24);
    expect(d.toISOString()).toBe('2028-01-31T00:00:00.000Z');
  });

  it('handles leap years (29 Feb 2024 + 12 months = 28 Feb 2025)', () => {
    const d = computeValidTo(new Date('2024-02-29T00:00:00Z'), 12);
    expect(d.toISOString()).toBe('2025-02-28T00:00:00.000Z');
  });

  it('handles 31st to 30th (31 Mar + 1 month = 30 Apr)', () => {
    const d = computeValidTo(new Date('2026-03-31T00:00:00Z'), 1);
    expect(d.toISOString()).toBe('2026-04-30T00:00:00.000Z');
  });
});
import { evaluateReadings } from '../src/rules.js';
import { generateId } from '../src/ids.js';

describe('evaluateReadings', () => {
  it('pass/fail at exactly the tolerance boundary', () => {
    // W-1 tolerance is 5.
    const exactlyOnBoundary = [{ applied: 100, observed: 105 }];
    expect(evaluateReadings('W-1', exactlyOnBoundary).pass).toBe(true);

    const slightlyOverBoundary = [{ applied: 100, observed: 105.1 }];
    expect(evaluateReadings('W-1', slightlyOverBoundary).pass).toBe(false);
  });
});

describe('id helpers', () => {
  it('produce the right formats', () => {
    expect(generateId.instrument(1)).toBe('NSH-I-000001');
    expect(generateId.application(2026, 42)).toBe('NSH-A-2026-000042');
    expect(generateId.receipt(2026, 9)).toBe('NSH-R-2026-000009');
    expect(generateId.certificate(2026, 999999)).toBe('NSH-C-2026-999999');
  });
});
