#!/usr/bin/env node
/**
 * Batch Device Key Generator
 * Generate credentials for multiple devices in one run.
 *
 * Usage examples:
 *   node scripts/batch-generate-device-keys.js ESP32_SUMP_002:sump_tank ESP32_TOP_001:top_tank
 *   node scripts/batch-generate-device-keys.js --write-file device_keys.json ESP32_A:top_tank ESP32_B:sump_tank
 *   node scripts/batch-generate-device-keys.js --sql-only ESP32_X:unknown
 *
 * Flags:
 *   --write-file <path>   Write/merge JSON map of devices (will NOT overwrite existing keys for same id unless --force)
 *   --force               Overwrite existing entries when writing file
 *   --sql-only            Print only SQL statements
 *   --snippets-only       Print only secrets.h snippets
 *   --json-only           Print only JSON map (all generated in-memory)
 *   --bytes-api <n>       Bytes for API key (default 32)
 *   --bytes-hmac <n>      Bytes for HMAC secret (default 64)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function arg(name, def){ const i = process.argv.indexOf(name); return (i!==-1 && i+1<process.argv.length)? process.argv[i+1]: def; }
function flag(name){ return process.argv.includes(name); }

const bytesApi = parseInt(arg('--bytes-api','32'),10);
const bytesHmac = parseInt(arg('--bytes-hmac','64'),10);
const outFile = arg('--write-file');
const force = flag('--force');
const sqlOnly = flag('--sql-only');
const snippetsOnly = flag('--snippets-only');
const jsonOnly = flag('--json-only');

const deviceArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
if(deviceArgs.length === 0){
  console.error('No devices provided. Format: DEVICE_ID[:device_type] ...');
  process.exit(1);
}

function randHex(n){ return crypto.randomBytes(n).toString('hex'); }

const devices = [];
for(const token of deviceArgs){
  const [id, type='unknown'] = token.split(':');
  if(!id){
    console.warn('Skipping invalid token', token);
    continue;
  }
  const api_key = randHex(bytesApi);
  const hmac_secret = randHex(bytesHmac);
  devices.push({ id, device_type: type, api_key, hmac_secret });
}

// Build outputs
const sqlStatements = devices.map(d => `insert into esp32_devices (id, api_key, hmac_secret, device_type, is_active, registered_at, last_seen, status)\nvalues ('${d.id}','${d.api_key}','${d.hmac_secret}','${d.device_type}', true, now(), now(), 'online')\nON CONFLICT (id) DO UPDATE SET api_key=excluded.api_key, hmac_secret=excluded.hmac_secret, is_active=true, device_type=excluded.device_type;`);

const secretsSnippets = devices.map(d => `// ${d.id}\n#define DEVICE_API_KEY "${d.api_key}"\n#define DEVICE_HMAC_SECRET "${d.hmac_secret}"\n#define HMAC_SECRET DEVICE_HMAC_SECRET\n`);

const jsonMap = devices.reduce((acc,d)=>{ acc[d.id] = { api_key: d.api_key, hmac_secret: d.hmac_secret, device_type: d.device_type }; return acc; }, {});

// Handle file merge
if(outFile){
  let existing = {};
  if(fs.existsSync(outFile)){
    try { existing = JSON.parse(fs.readFileSync(outFile,'utf8')); } catch(e){ console.warn('Could not parse existing file, starting fresh'); }
  }
  for(const d of devices){
    if(existing[d.id] && !force){
      console.warn(`Skipping existing device ${d.id} (use --force to overwrite)`);
      continue;
    }
    existing[d.id] = { api_key: d.api_key, hmac_secret: d.hmac_secret, device_type: d.device_type };
  }
  fs.writeFileSync(outFile, JSON.stringify(existing,null,2));
  console.log(`[write] Updated ${outFile} with ${devices.length} devices (some may be skipped if existing).`);
}

if(!snippetsOnly && !jsonOnly){
  console.log('--- SQL ---');
  console.log(sqlStatements.join('\n\n'));
}
if(!sqlOnly && !jsonOnly){
  console.log('\n--- secrets.h snippets (choose ONE set per firmware build) ---');
  console.log(secretsSnippets.join('\n'));
}
if(!sqlOnly && !snippetsOnly){
  console.log('\n--- JSON Map ---');
  console.log(JSON.stringify(jsonMap,null,2));
}

console.log('\nDone.');
