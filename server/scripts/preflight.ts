import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

console.log('✈️  Starting Preflight Checks...\n');

try {
  // 1. Node Version Check
  console.log('[1/7] Checking Node Version...');
  const nodeVersion = process.version;
  if (!nodeVersion.startsWith('v24') && !nodeVersion.startsWith('v22') && !nodeVersion.startsWith('v20')) {
    console.warn(`⚠️ Warning: Recommended Node version is v20, v22, or v24. Found ${nodeVersion}`);
  } else {
    console.log(`✅ Node Version OK (${nodeVersion})`);
  }

  // 2. Keys Check
  console.log('\n[2/7] Checking ECDSA Keys...');
  const keyDir = path.resolve(process.cwd(), '.keys');
  if (fs.existsSync(path.join(keyDir, 'private.pem')) && fs.existsSync(path.join(keyDir, 'public.pem'))) {
    console.log('✅ Keys exist.');
  } else {
    console.error('❌ Keys missing! Run `npm run demo:setup` first.');
    process.exit(1);
  }

  // 3. Storage Check
  console.log('\n[3/7] Checking Storage...');
  const uploadDir = path.resolve(process.cwd(), 'uploads');
  if (fs.existsSync(uploadDir)) {
    console.log('✅ Uploads directory exists.');
  } else {
    console.error('❌ Uploads directory missing!');
    process.exit(1);
  }

  // 4. Migrations Check
  console.log('\n[4/7] Checking Migrations & Seed...');
  if (fs.existsSync(path.resolve(process.cwd(), 'storage/nishchay.db')) || fs.existsSync(path.resolve(process.cwd(), 'local.db'))) {
    console.log('✅ db exists.');
  } else {
    console.error('❌ db missing! Run `npm run demo:setup` first.');
    process.exit(1);
  }

  // 5. Port / Health Check
  console.log('\n[5/7] Checking Server Health...');
  const req = http.get('http://localhost:4000/api/auth/me', (res) => {
    // 403 is fine, it means auth is working but we aren't logged in. 200 is also fine.
    if (res.statusCode === 200 || res.statusCode === 403) {
      console.log('✅ Server is healthy (Port 4000 active).');
      
      // 6. Test Suite
      console.log('\n[6/7] Running Unit & Integration Tests...');
      try {
        execSync('npm run test', { stdio: 'inherit' });
        console.log('✅ Tests passed.');
        
        // 7. Linting & Formatting
        console.log('\n[7/7] Running Typecheck & Lint...');
        execSync('npm run typecheck', { stdio: 'inherit' });
        execSync('npm run lint', { stdio: 'inherit' });
        console.log('✅ Typecheck & Lint passed.');
        
        console.log('\n🚀 ALL PREFLIGHT CHECKS PASSED SUCCESSFULLY!');
        process.exit(0);
      } catch (err) {
        console.error('❌ Tests or Linting failed.');
        process.exit(1);
      }
    } else {
      console.error(`❌ Server returned status ${res.statusCode}.`);
      process.exit(1);
    }
  });

  req.on('error', (e) => {
    console.error(`❌ Server is NOT running on Port 4000: ${e.message}`);
    process.exit(1);
  });

} catch (error) {
  console.error('\n❌ Preflight failed with an unexpected error:', error);
  process.exit(1);
}
