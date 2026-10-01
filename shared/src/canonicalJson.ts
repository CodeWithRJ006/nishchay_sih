function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function canonicalJson(data: unknown): string {
  if (data === undefined) {
    throw new Error('canonicalJson: undefined is not allowed');
  }
  if (typeof data === 'number' && (Number.isNaN(data) || !Number.isFinite(data))) {
    throw new Error('canonicalJson: NaN and Infinity are not allowed');
  }
  if (typeof data === 'string') {
    return JSON.stringify(data.normalize('NFC'));
  }
  if (data instanceof Date) {
    return JSON.stringify(data.toISOString());
  }
  if (Array.isArray(data)) {
    return '[' + data.map(canonicalJson).join(',') + ']';
  }
  if (isPlainObject(data)) {
    const keys = Object.keys(data).sort();
    let result = '{';
    let first = true;
    for (const key of keys) {
      const val = data[key];
      if (val === undefined) continue;
      if (!first) result += ',';
      result += JSON.stringify(key.normalize('NFC')) + ':' + canonicalJson(val);
      first = false;
    }
    result += '}';
    return result;
  }
  return JSON.stringify(data);
}
