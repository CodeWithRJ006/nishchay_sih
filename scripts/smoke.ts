import { performance } from 'perf_hooks';
import crypto from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
let currentToken = '';
const currentCsrf = 'test';

async function step(name: string, fn: () => Promise<void>) {
  const start = performance.now();
  try {
    await fn();
    const ms = (performance.now() - start).toFixed(0);
    process.stdout.write(String(`[PASS] ${name} - ${ms}ms`) + '\n');
  } catch (err: Error) {
    const ms = (performance.now() - start).toFixed(0);
    process.stdout.write(String(`[FAIL] ${name} - ${ms}ms - ${err.message}`) + '\n');
    process.exit(1);
  }
}

async function request(method: string, urlPath: string, body?: unknown, useToken: boolean = true, extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {};
  if (useToken && currentToken) {
    headers['Cookie'] = `token=${currentToken}`;
  }
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    headers['x-csrf-token'] = currentCsrf;
  }
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  let fetchBody: BodyInit | undefined = undefined;
  if (body instanceof FormData) {
    fetchBody = body;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: fetchBody
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/token=([^;]+)/);
    if (match) currentToken = match[1];
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

async function run() {
  process.stdout.write(String(`Starting smoke test against ${BASE_URL}`) + '\n');

  let instrumentId = '';
  let applicationId = '';
  let publicId = '';

  await step('Login as BUSINESS (demo-as)', async () => {
    await request('POST', '/api/demo/login-as/BUSINESS', undefined, false);
  });

  await step('Register instrument', async () => {
    const res = await request('POST', '/api/instruments', {
      type_code: 'W-1',
      make: 'SmokeMake',
      model: 'SmokeModel',
      serial: `SMK-${Date.now()}`,
      capacity: '10kg',
      class: 'Class II'
    });
    instrumentId = res.id;
  });

  await step('Apply', async () => {
    const res = await request('POST', '/api/applications', {
      instrument_id: instrumentId,
      documents: [{
        doc_type: 'Invoice',
        file_name: 'dummy.pdf',
        file_hash: 'dummysha256'
      }]
    });
    applicationId = res.id;
  });

  await step('Pay (sandbox callback)', async () => {
    const initRes = await request('POST', '/api/payments/initiate', {
      applicationId,
      amount: 100
    });
    const txId = (initRes as Record<string, string>).paymentId;
    const ts = Date.now();
    const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret');
    hmac.update(`${txId}:SUCCESS:100:${ts}:${applicationId}`);
    const signature = hmac.digest('hex');

    await request('POST', '/api/payments/callback', {
      paymentId: txId,
      applicationId,
      status: 'SUCCESS',
      amount: 100,
      timestamp: ts
    }, false, { 'x-hmac-signature': signature }); 
  });
  await step('Login as BUSINESS (demo-as)', async () => {
    await request('POST', '/api/demo/login-as/BUSINESS', undefined, false);
  });

  await step('Schedule', async () => {
    const res = await request('POST', '/api/appointments/schedule', {
      applicationId: applicationId,
      slotDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      slotTime: '09:00'
    });
    process.stdout.write(JSON.stringify(res) + '\n');
  });

  await step('Login as LMO (demo-as)', async () => {
    await request('POST', '/api/demo/login-as/LMO', undefined, false);
  });

  await step('Officer accept', async () => {
    await request('POST', `/api/appointments/accept`, {
      applicationId: applicationId
    });
  });

  await step('Arrive', async () => {
    await request('POST', `/api/field/jobs/${applicationId}/arrive`, {
      gps_lat: 28.6139,
      gps_lng: 77.2090
    });
  });

  await step('Upload two photos & Inspection PASS', async () => {
    // We create a dummy PNG
    const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const hash = crypto.createHash('sha256').update(dummyPng).digest('hex');
    const form = new FormData();
    form.append('checklist', JSON.stringify([{ item: 'Weight', ok: true }]));
    form.append('readings', JSON.stringify([{ val: 10 }]));
    form.append('pass', 'true');
    form.append('clientHashes', JSON.stringify([hash, hash]));
    form.append('clientCaptureTimes', JSON.stringify([new Date().toISOString(), new Date().toISOString()]));
    form.append('files', new Blob([dummyPng], { type: 'image/png' }), 'photo1.png');
    form.append('files', new Blob([dummyPng], { type: 'image/png' }), 'photo2.png');

    const res = await request('POST', `/api/field/jobs/${applicationId}/inspection`, form);
    if (!res.certificateId) {
      throw new Error('Certificate ID not returned from inspection PASS');
    }
    publicId = res.certificateId;
  });

  await step('Certificate exists & Public verify returns VALID', async () => {
    const res = await request('GET', `/api/certificates/${publicId}`, undefined, false);
    if (res.status !== 'VALID') {
      throw new Error('Certificate status is not VALID');
    }
  });

  await step('Complaint accepted', async () => {
    const res = await request('POST', `/api/certificates/${publicId}/complaint`, {
      note: 'Smoke test complaint'
    }, false);
    if (!res.success) {
      throw new Error('Complaint rejected');
    }
  });

  process.stdout.write(String('Smoke test completed successfully.') + '\n');
}

run();
