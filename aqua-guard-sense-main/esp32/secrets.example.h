#pragma once
// Copy this file to secrets.h and fill real values. Do NOT commit secrets.h

// Per-device API key issued by backend (esp32_devices.api_key)
#define DEVICE_API_KEY "YOUR_DEVICE_API_KEY_HERE"

// Per-device HMAC secret (esp32_devices.hmac_secret)
#define DEVICE_HMAC_SECRET "YOUR_DEVICE_HMAC_SECRET_HERE"

// For top tank firmware which expects HMAC_SECRET name
#define HMAC_SECRET DEVICE_HMAC_SECRET

// Compile-time safety: prevent flashing with placeholder values
#if defined(DEVICE_API_KEY) && (DEVICE_API_KEY[0] == 'Y')
#warning "DEVICE_API_KEY appears to be a placeholder. Replace before production."
#endif
#if defined(DEVICE_HMAC_SECRET) && (DEVICE_HMAC_SECRET[0] == 'Y')
#warning "DEVICE_HMAC_SECRET appears to be a placeholder. Replace before production."
#endif
