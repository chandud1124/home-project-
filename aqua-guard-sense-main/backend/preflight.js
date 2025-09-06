#!/usr/bin/env node
/* Preflight checks before starting backend.
 * - Ensures required env vars are present
 * - Warns if fallback DEVICE_KEYS_JSON is still active
 * - Optionally verifies required device rows exist in Supabase (if service key available)
 */
const requiredEnv = ['SUPABASE_URL','SUPABASE_ANON_KEY'];
let failed = false;
for(const key of requiredEnv){
  if(!process.env[key]){ console.error(`[preflight] Missing env var: ${key}`); failed = true; }
}
if(process.env.DEVICE_KEYS_JSON){
  console.warn('[preflight] WARNING: DEVICE_KEYS_JSON is set. Remove after seeding devices.');
}
if(process.env.HMAC_REQUIRED === 'true' && !process.env.HMAC_TIME_DRIFT_SECONDS){
  console.warn('[preflight] HMAC_REQUIRED=true but HMAC_TIME_DRIFT_SECONDS unset; defaulting to 300');
}
// Optional: verify required device IDs passed via REQUIRED_DEVICE_IDS="SUMP-001,TOP-001"
(async () => {
  const idsRaw = process.env.REQUIRED_DEVICE_IDS;
  if(idsRaw && process.env.SUPABASE_SERVICE_ROLE_KEY){
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const ids = idsRaw.split(',').map(s=>s.trim()).filter(Boolean);
      if(ids.length){
        const { data, error } = await supabase.from('esp32_devices').select('id').in('id', ids);
        if(error){
          console.error('[preflight] Error querying esp32_devices:', error.message);
          failed = true;
        } else {
          const found = new Set(data.map(d=>d.id));
            ids.forEach(id=>{ if(!found.has(id)){ console.error(`[preflight] Missing device row: ${id}`); failed = true; } });
        }
      }
    } catch(e){
      console.error('[preflight] Supabase verification failed:', e.message);
      failed = true;
    }
  }
  if(failed){
    console.error('[preflight] FAILED checks. Aborting.');
    process.exit(1);
  } else {
    console.log('[preflight] All checks passed.');
  }
})();
