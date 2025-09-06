// Basic protocol version middleware tests (lightweight)
// NOTE: This does not spin up full server with Supabase; we stub minimal parts.

const express = require('express');
const bodyParser = require('body-parser');

// Re-import server file would execute full startup; instead we recreate middleware logic inline
const PROTOCOL_MIN_VERSION = parseInt(process.env.PROTOCOL_MIN_VERSION || '1', 10);
const PROTOCOL_MAX_VERSION = parseInt(process.env.PROTOCOL_MAX_VERSION || '1', 10);

const validateProtocolVersion = (req, res, next) => {
  const b = req.body || {};
  const version = b.protocol_version || b?.payload?.protocol_version || b?.data?.protocol_version;
  if (version == null) {
    if (PROTOCOL_MIN_VERSION > 1) return res.status(400).json({ error: 'protocol_version missing' });
    return next();
  }
  const vNum = parseInt(version, 10);
  if (isNaN(vNum)) return res.status(400).json({ error: 'protocol_version not a number' });
  if (vNum < PROTOCOL_MIN_VERSION) return res.status(426).json({ error: 'protocol_version too low', min: PROTOCOL_MIN_VERSION, received: vNum });
  if (vNum > PROTOCOL_MAX_VERSION) return res.status(400).json({ error: 'protocol_version unsupported (future)', max: PROTOCOL_MAX_VERSION, received: vNum });
  return res.json({ ok: true, version: vNum });
};

const app = express();
app.use(bodyParser.json());
app.post('/test', validateProtocolVersion);

// Export for manual invocation (simple)
module.exports = app;

if (require.main === module) {
  const request = require('supertest');
  (async () => {
    await request(app).post('/test').send({ protocol_version: PROTOCOL_MIN_VERSION }).expect(200);
    if (PROTOCOL_MIN_VERSION > 1) {
      await request(app).post('/test').send({ protocol_version: PROTOCOL_MIN_VERSION - 1 }).expect(426);
    }
    await request(app).post('/test').send({ protocol_version: PROTOCOL_MAX_VERSION + 1 }).expect(400);
    console.log('Protocol version tests (inline) completed');
  })();
}
