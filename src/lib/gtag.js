import { UAParser } from 'ua-parser-js';

export const GA_TRACKING_ID = 'G-DGE70PDCMN'; // Updated to new GA4 Measurement ID

// Utility to get readable device info
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

// Send custom events to Google Analytics 4
export const gtagEvent = ({ action, category, label, value, page_path, timestamp, ...rest }) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
      page_path: page_path || window.location.pathname,
      timestamp: timestamp || Date.now(),
      ...rest,
    });
  }
};
