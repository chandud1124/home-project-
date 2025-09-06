// Example ESP32 Configuration
// Copy this to esp32_config.h and update with your actual values

#ifndef ESP32_CONFIG_H
#define ESP32_CONFIG_H

// ========== DEVICE CONFIGURATION ==========
#define DEVICE_ID "ESP32_SUMP_002"  // Change this for each ESP32
#define DEVICE_NAME "Sump Tank Controller"

// ========== API CONFIGURATION ==========
// Get these from your frontend when adding the ESP32 device
#define DEVICE_API_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4"
#define DEVICE_HMAC_SECRET "c2858fe0513830bfe988a46e8162d9ef6fec933758156a901a41012afde8bb5b7fa1cee9e677cbe72aa0e84a4b4c72aabf8f33ad1d989ba4b69ca9e1b1e1e0c2"

// ========== WIFI CONFIGURATION ==========
#define WIFI_SSID "I am Not A Witch I am Your Wifi"
#define WIFI_PASSWORD "Whoareu@0000"

// ========== BACKEND CONFIGURATION ==========
#define BACKEND_HOST "dwcouaacpqipvvsxiygo.supabase.co"
#define BACKEND_PORT 443
#define BACKEND_USE_TLS true

// ========== SENSOR CONFIGURATION ==========
#define TRIG_PIN 5
#define ECHO_PIN 18
#define FLOAT_SWITCH_PIN 4

// ========== MOTOR CONTROL (SUMP TANK ONLY) ==========
#define MOTOR_RELAY_PIN 13
#define BUZZER_PIN 14
#define AUTO_MODE_LED_PIN 16
#define SUMP_FULL_LED_PIN 17
#define SUMP_LOW_LED_PIN 21
#define MANUAL_MOTOR_SWITCH_PIN 25
#define MODE_SWITCH_PIN 26

// ========== TANK CONFIGURATION ==========
#define TANK_HEIGHT_CM 250.0
#define TANK_LENGTH_CM 230.0
#define TANK_BREADTH_CM 230.0
#define SENSOR_OFFSET_CM 0.0

// ========== MOTOR CONTROL PARAMETERS ==========
#define MOTOR_MAX_RUNTIME_MINUTES 30
#define MOTOR_MIN_REST_TIME_MINUTES 5
#define SUMP_MIN_LEVEL_PERCENT 15.0
#define SUMP_MAX_LEVEL_PERCENT 90.0
#define SUMP_CRITICAL_LEVEL_PERCENT 5.0

// ========== AUTO CONTROL LEVELS ==========
#define AUTO_START_LEVEL_PERCENT 75.0
#define AUTO_STOP_LEVEL_PERCENT 25.0

// ========== TIMING CONFIGURATION ==========
#define SENSOR_READ_INTERVAL_MS 2000
#define HEARTBEAT_INTERVAL_MS 30000
#define WIFI_RECONNECT_ATTEMPTS 5

#endif // ESP32_CONFIG_H
