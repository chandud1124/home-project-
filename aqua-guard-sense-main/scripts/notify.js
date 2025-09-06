#!/usr/bin/env node
/** Simple CI failure notifier.
 * Usage: node scripts/notify.js "message text"
 * Requires WEBHOOK_URL env var.
 */
const https = require('https');
const url = process.env.WEBHOOK_URL;
const msg = process.argv.slice(2).join(' ') || 'Build failed';
if(!url){
  console.error('[notify] WEBHOOK_URL not set; skipping');
  process.exit(0);
}
const data = JSON.stringify({
  text: msg,
  repository: process.env.GITHUB_REPOSITORY,
  commit: process.env.GITHUB_SHA,
  run: process.env.GITHUB_RUN_ID,
  time: new Date().toISOString()
});
const u = new URL(url);
const opts = { method: 'POST', hostname: u.hostname, path: u.pathname + (u.search||''), headers: { 'Content-Type':'application/json','Content-Length':Buffer.byteLength(data) }};
const req = https.request(opts, res => { res.on('data',()=>{}); res.on('end',()=> console.log('[notify] done status', res.statusCode));});
req.on('error', e => console.error('[notify] error', e.message));
req.write(data);
req.end();
