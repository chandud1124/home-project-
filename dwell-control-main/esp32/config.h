
#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Server Configuration
#define SERVER_URL "http://YOUR_SERVER_IP:3001"
#define WEBSOCKET_HOST "YOUR_SERVER_IP"
#define WEBSOCKET_PORT 3001

// Device Configuration
#define DEVICE_NAME "Classroom ESP32 Controller"
#define DEVICE_LOCATION "Room 101"
#define CLASSROOM_NAME "Computer Science Lab 1"
#define FIRMWARE_VERSION "v1.0.0"

// Switch Configuration
const String SWITCH_NAMES[4] = {
  "Main Lights",
  "Ceiling Fan", 
  "Projector",
  "Smart Board"
};

const String SWITCH_TYPES[4] = {
  "light",
  "fan",
  "projector", 
  "smartboard"
};

// PIR Sensor Configuration
#define HAS_PIR_SENSOR true
#define PIR_SENSITIVITY 80
#define PIR_TIMEOUT 300 // seconds

// Which switches should be controlled by PIR sensor (true/false for each switch)
const bool PIR_LINKED_SWITCHES[4] = {
  true,  // Main Lights
  false, // Ceiling Fan
  false, // Projector
  false  // Smart Board
};

// GPIO Pin Configuration
// Note: Modify these according to your ESP32 board and wiring
// Make sure pins don't conflict with built-in functions

// Available GPIO pins for ESP32:
// Output pins: 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27
// Input pins: 0, 1, 3, 6, 7, 8, 9, 10, 11, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39

// PIR sensor recommended pins: 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39

#endif
