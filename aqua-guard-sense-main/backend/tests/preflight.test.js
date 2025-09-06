import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PRE = join(process.cwd(), 'backend', 'preflight.js');

function run(cmd, env={}){
  return execSync(cmd, { stdio: 'pipe', env: { ...process.env, ...env } }).toString();
}

describe('preflight script', () => {
  test('fails when required env missing', () => {
    let failed = false;
    try {
      run(`node ${PRE}`, { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' });
    } catch (e) {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  test('passes minimal env', () => {
    const out = run(`node ${PRE}`, { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'anon' });
    expect(out).toMatch(/All checks passed|WARNING/);
  });

  test('warns when DEVICE_KEYS_JSON set', () => {
    let output = '';
    try {
      output = run(`node ${PRE}`, { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'anon', DEVICE_KEYS_JSON: '{"X":{"api_key":"k","hmac_secret":"s"}}' });
    } catch (e) {
      output = e.stdout?.toString() || '';
    }
    expect(output).toMatch(/DEVICE_KEYS_JSON is set/);
  });
});
