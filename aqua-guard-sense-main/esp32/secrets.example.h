#pragma once
// Copy this file to secrets.h and fill real values. Do NOT commit secrets.h

// Per-device API key issued by backend (esp32_devices.api_key)
#define DEVICE_API_KEY "YOUR_DEVICE_API_KEY_HERE"

// Per-device HMAC secret (esp32_devices.hmac_secret)
#define DEVICE_HMAC_SECRET "YOUR_DEVICE_HMAC_SECRET_HERE"

// For top tank firmware which expects HMAC_SECRET name
#define HMAC_SECRET DEVICE_HMAC_SECRET
