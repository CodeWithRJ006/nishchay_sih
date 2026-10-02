

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

process.stdout.write(String('✈️  Starting Preflight Checks...\n') + '\n');

try {
  // 1. Node Version Check
  process.stdout.write(String('[1/7] Checking Node Version...') + '\n');
  const nodeVersion = process.version;
  if (!nodeVersion.startsWith('v24') && !nodeVersion.startsWith('v22') && !nodeVersion.startsWith('v20')) {
    process.stderr.write(String(`⚠️ Warning: Recommended Node version is v20, v22, or v24. Found ${nodeVersion}`) + '\n');
  } else {
    process.stdout.write(String(`✅ Node Version OK (${nodeVersion})`) + '\n');
  }

  // 2. Keys Check
  process.stdout.write(String('\n[2/7] Checking ECDSA Keys...') + '\n');
  const keyDir = path.resolve(process.cwd(), '.keys');
  if (fs.existsSync(path.join(keyDir, 'private.pem')) && fs.existsSync(path.join(keyDir, 'public.pem'))) {
    process.stdout.write(String('✅ Keys exist.') + '\n');
  } else {
    process.stderr.write(String('❌ Keys missing! Run `npm run demo:setup` first.') + '\n');
    process.exit(1);
  }

  // 3. Storage Check
  process.stdout.write(String('\n[3/7] Checking Storage...') + '\n');
  const uploadDir = process.env.STORAGE_DIR || path.resolve(process.cwd(), 'storage', 'uploads');
  if (fs.existsSync(uploadDir)) {
    process.stdout.write(String('✅ Uploads directory exists.') + '\n');
  } else {
    process.stderr.write(String('❌ Uploads directory missing!') + '\n');
    process.exit(1);
  }

  // 4. Migrations Check
  process.stdout.write(String('\n[4/7] Checking Migrations & Seed...') + '\n');
  if (fs.existsSync(path.resolve(process.cwd(), 'storage/nishchay.db')) || fs.existsSync(path.resolve(process.cwd(), 'local.db'))) {
    process.stdout.write(String('✅ db exists.') + '\n');
  } else {
    process.stderr.write(String('❌ db missing! Run `npm run demo:setup` first.') + '\n');
    process.exit(1);
  }

  // 5. Port / Health Check
  process.stdout.write(String('\n[5/7] Checking Server Health...') + '\n');
  const req = http.get('http://localhost:4000/api/auth/me', (res) => {
    // 403 is fine, it means auth is working but we aren't logged in. 200 is also fine.
    if (res.statusCode === 200 || res.statusCode === 403) {
      process.stdout.write(String('✅ Server is healthy (Port 4000 active).') + '\n');
      
      // 6. Test Suite
      process.stdout.write(String('\n[6/7] Running Unit & Integration Tests...') + '\n');
      try {
        execSync('npm run test', { stdio: 'inherit' });
        process.stdout.write(String('✅ Tests passed.') + '\n');
        
        // 7. Linting & Formatting
        process.stdout.write(String('\n[7/7] Running Typecheck & Lint...') + '\n');
        execSync('npm run typecheck', { stdio: 'inherit' });
        execSync('npm run lint', { stdio: 'inherit' });
        process.stdout.write(String('✅ Typecheck & Lint passed.') + '\n');
        
        process.stdout.write(String('\n🚀 ALL PREFLIGHT CHECKS PASSED SUCCESSFULLY!') + '\n');
        process.exit(0);
      } catch {
        process.stderr.write(String('❌ Tests or Linting failed.') + '\n');
        process.exit(1);
      }
    } else {
      process.stderr.write(String(`❌ Server returned status ${res.statusCode}.`) + '\n');
      process.exit(1);
    }
  });

  req.on('error', (e) => {
    process.stderr.write(String(`❌ Server is NOT running on Port 4000: ${e.message}`) + '\n');
    process.exit(1);
  });

} catch (error) {
  process.stderr.write(String('\n? Preflight failed with an unexpected error: ') + String(error) + '\n');
  process.exit(1);
}
