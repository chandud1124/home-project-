#!/usr/bin/env node
/**
 * Device Key Generator
 * Generates a random API key + HMAC secret and prints:
 * 1. SQL upsert for esp32_devices
 * 2. secrets.h snippet
 * 3. curl heartbeat test example
 *
 * Usage:
 *   node scripts/generate-device-keys.js --id ESP32_SUMP_002 --type sump_tank
 * Options:
 *   --id <device_id>            (required)
 *   --type <device_type>        (default: unknown)
 *   --hex                       Force hex output (default hex)
 *   --bytes-api <n>             Random bytes for API key (default 32)
 *   --bytes-hmac <n>            Random bytes for HMAC secret (default 64)
 */
const crypto = require('crypto');

function arg(name, def){
  const i = process.argv.indexOf(name);
  if (i !== -1 && i+1 < process.argv.length) return process.argv[i+1];
  return def;
}
function flag(name){ return process.argv.includes(name); }

const deviceId = arg('--id');
if(!deviceId){
  console.error('Error: --id <device_id> required');
  process.exit(1);
}
const deviceType = arg('--type','unknown');
const bytesApi = parseInt(arg('--bytes-api','32'),10);
const bytesHmac = parseInt(arg('--bytes-hmac','64'),10);

function randHex(n){ return crypto.randomBytes(n).toString('hex'); }
const apiKey = randHex(bytesApi);
const hmacSecret = randHex(bytesHmac);

const sql = `insert into esp32_devices (id, api_key, hmac_secret, device_type, is_active, registered_at, last_seen, status)\nvalues ('${deviceId}','${apiKey}','${hmacSecret}','${deviceType}', true, now(), now(), 'online')\nON CONFLICT (id) DO UPDATE SET api_key=excluded.api_key, hmac_secret=excluded.hmac_secret, is_active=true, device_type=excluded.device_type;`;

const secretsSnippet = `#pragma once\n#define DEVICE_API_KEY "${apiKey}"\n#define DEVICE_HMAC_SECRET "${hmacSecret}"\n#define HMAC_SECRET DEVICE_HMAC_SECRET\n`;

const body = '{"esp32_id":"'+deviceId+'"}';
const tsVar = 'TS=$(date +%s)';
const sigVar = `SIG=$(printf '${deviceId}${body}$$TS' | openssl dgst -sha256 -hmac ${hmacSecret} -hex | awk '{print $2}')`;
const curl = `${tsVar}; ${sigVar}; curl -X POST $BACKEND/api/esp32/heartbeat -H 'Content-Type: application/json' -H 'x-device-id: ${deviceId}' -H 'x-api-key: ${apiKey}' -H "x-timestamp: $TS" -H "x-signature: $SIG" -d '${body}'`;

console.log('--- SQL (execute via supabase db execute) ---');
console.log(sql);
console.log('\n--- secrets.h snippet (DO NOT COMMIT) ---');
console.log(secretsSnippet);

console.log('--- Heartbeat test (set BACKEND env var to base URL incl scheme+host+port) ---');
console.log(curl);
