// Device info utility using ua-parser-js
import UAParser from 'ua-parser-js';

export function getDeviceInfo() {
  const parser = new UAParser();
  const result = parser.getResult();
  const deviceType = result.device.type || 'desktop';
  const deviceVendor = result.device.vendor || '';
  const deviceModel = result.device.model || '';
  const os = result.os.name || '';
  const browser = result.browser.name || '';

  let deviceLabel = deviceType.charAt(0).toUpperCase() + deviceType.slice(1);
  if (deviceVendor) deviceLabel += ` ${deviceVendor}`;
  if (deviceModel) deviceLabel += ` ${deviceModel}`;
  if (os) deviceLabel += ` (${os})`;
  if (browser) deviceLabel += ` - ${browser}`;

  return {
    deviceType,
    deviceVendor,
    deviceModel,
    os,
    browser,
    deviceLabel: deviceLabel.trim(),
  };
}
