#!/usr/bin/env node
// Fails CI if forbidden patterns detected.
const fs = require('fs');
const path = require('path');
const rootEnv = path.join(process.cwd(), '.env');
let failed = false;
function scan(file){
  if(!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file,'utf8');
  if(/DEVICE_KEYS_JSON\s*=\s*['"]?\{/.test(txt) && !/^#/m.test(txt.split('\n').find(l=>l.includes('DEVICE_KEYS_JSON'))||'')){
    console.error(`[check-env] DEVICE_KEYS_JSON active in ${file}. Comment it out after seeding.`);
    failed = true;
  }
  // Basic check: no accidental service role in frontend .env
  if(/SUPABASE_SERVICE_ROLE_KEY=/.test(txt)){
    console.error(`[check-env] SUPABASE_SERVICE_ROLE_KEY should not be in root .env (frontend-exposed). Move to backend/.env.`);
    failed = true;
  }
}
scan(rootEnv);
if(failed){
  console.error('[check-env] Environment validation failed.');
  process.exit(1);
} else {
  console.log('[check-env] Environment looks good.');
}
