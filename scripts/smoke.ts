import { performance } from 'perf_hooks';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
let currentToken = '';
let currentCsrf = 'test';

async function step(name: string, fn: () => Promise<void>) {
  const start = performance.now();
  try {
    await fn();
    const ms = (performance.now() - start).toFixed(0);
    console.log(`[PASS] ${name} - ${ms}ms`);
  } catch (err: any) {
    const ms = (performance.now() - start).toFixed(0);
    console.log(`[FAIL] ${name} - ${ms}ms - ${err.message}`);
    process.exit(1);
  }
}

async function request(method: string, urlPath: string, body?: any, useToken: boolean = true) {
  const headers: Record<string, string> = {};
  if (useToken && currentToken) {
    headers['Cookie'] = `token=${currentToken}`;
    headers['x-csrf-token'] = currentCsrf;
  }

  let fetchBody: BodyInit | undefined = undefined;
  if (body instanceof FormData) {
    fetchBody = body as any;
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
  console.log(`Starting smoke test against ${BASE_URL}`);

  let instrumentId = '';
  let applicationId = '';
  let publicId = '';

  await step('Login as BUSINESS (demo-as)', async () => {
    await request('POST', '/api/demo/login-as/BUSINESS', undefined, false);
  });

  await step('Register instrument', async () => {
    const res = await request('POST', '/api/instruments', {
      type_code: 'WI-01',
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
    const txId = `PAY-${applicationId}`;
    const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret');
    hmac.update(`${txId}:${applicationId}:${instrumentId}:500`);
    const signature = hmac.digest('hex');

    await request('POST', '/api/payments/callback', {
      transactionId: txId,
      applicationId,
      status: 'SUCCESS',
      amount: 500,
      signature
    }, false); 
  });

  await step('Login as GATC (demo-as)', async () => {
    await request('POST', '/api/demo/login-as/GATC', undefined, false);
  });

  await step('Schedule', async () => {
    await request('POST', `/api/appointments/schedule`, {
      application_id: applicationId,
      scheduled_date: new Date(Date.now() + 86400000).toISOString(),
      officer_id: 'USR-LMO1'
    });
  });

  await step('Login as LMO (demo-as)', async () => {
    await request('POST', '/api/demo/login-as/LMO', undefined, false);
  });

  await step('Officer accept', async () => {
    await request('POST', `/api/appointments/accept`, {
      application_id: applicationId
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
    const form = new FormData();
    form.append('checklist', JSON.stringify([{ item: 'Weight', ok: true }]));
    form.append('readings', JSON.stringify([{ val: 10 }]));
    form.append('pass', 'true');
    form.append('photos', new Blob([dummyPng], { type: 'image/png' }), 'photo1.png');
    form.append('photos', new Blob([dummyPng], { type: 'image/png' }), 'photo2.png');

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

  console.log('Smoke test completed successfully.');
}

run();
