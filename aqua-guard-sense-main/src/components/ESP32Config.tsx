
import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Settings, Download, Upload, Wifi, Zap, Droplets, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ESP32PinConfig {
  trigPin: number;
  echoPin: number;
  floatPin?: number;
  relayPin?: number;
  buzzerPin?: number;
  redLedPin?: number;
  greenLedPin?: number;
}

interface ESP32Config {
  _id?: string;
  id: string;
  name: string;
  type: 'top_tank' | 'sump_motor';
  wifiSSID: string;
  wifiPassword: string;
  serverURL: string;
  pins: ESP32PinConfig;
  tankCapacity: number;
  tankHeight: number;
  sensorOffset: number;
  autoStartLevel: number;
  autoStopLevel: number;
  maxRuntime: number;
  safetyTimeout: number;
  // Network information
  mac_address?: string;
  ip_address?: string;
  is_connected?: boolean;
  last_seen?: string;
  status?: string;
  current_ip?: string;
}

export const ESP32Config = ({ 
  onRequestEsp32Save,
  onRequestEsp32Update 
}: {
  onRequestEsp32Save?: (deviceName: string, onSuccess: () => void) => void;
  onRequestEsp32Update?: (deviceName: string, onSuccess: () => void) => void;
} = {}) => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ESP32Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState<ESP32Config | null>(null);
  const [isAddingDevice, setIsAddingDevice] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  // Load devices from backend
  const loadDevices = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('http://localhost:3001/api/esp32/devices');
      const data = await response.json();
      if (data.success) {
        // Ensure all devices have proper pins configuration
        const devicesWithPins = data.devices.map((device: ESP32Config) => ({
          ...device,
          pins: device.pins || { trigPin: 5, echoPin: 18 }
        }));
        setConfigs(devicesWithPins);
        toast({
          title: "Devices Refreshed",
          description: `Found ${data.devices.length} device(s)`,
        });
      }
    } catch (error) {
      console.error('Error loading devices:', error);
      toast({
        title: "Error",
        description: "Failed to load device configurations.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDevices();

    // Refresh device status every 30 seconds
    const interval = setInterval(loadDevices, 30000);
    return () => clearInterval(interval);
  }, [toast]);

  const addNewDevice = () => {
    const timestamp = Date.now();
    const newDevice: ESP32Config = {
      id: `ESP32_${timestamp}`,
      name: 'New ESP32 Device',
      type: 'top_tank',
      wifiSSID: '',
      wifiPassword: '',
      serverURL: 'http://192.168.1.100:3001',
      pins: { trigPin: 5, echoPin: 18 },
      tankCapacity: 1000,
      tankHeight: 200,
      sensorOffset: 20,
      autoStartLevel: 20,
      autoStopLevel: 90,
      maxRuntime: 30,
      safetyTimeout: 60,
      mac_address: '',
      ip_address: '',
      status: 'configured'
    };
    setEditingConfig(newDevice);
    setIsAddingDevice(true);
  };

  const saveNewDevice = async (newConfig: ESP32Config) => {
    const performSave = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/esp32/devices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newConfig),
        });
        const data = await response.json();
        if (data.success) {
          setConfigs(prev => [...prev, { ...newConfig, _id: data.deviceId }]);
          setEditingConfig(null);
          setIsAddingDevice(false);
          toast({
            title: "Device Added",
            description: `${newConfig.name} has been added successfully.`,
          });
        } else {
          throw new Error(data.error);
        }
      } catch (error) {
        console.error('Error saving device:', error);
        toast({
          title: "Error",
          description: "Failed to save device configuration.",
          variant: "destructive",
        });
      }
    };

    if (onRequestEsp32Save) {
      onRequestEsp32Save(newConfig.name, performSave);
    } else {
      await performSave();
    }
  };

  const generateArduinoCode = (config: ESP32Config) => {
    const isMotorController = config.type === 'sump_motor';

    return `// ${config.name} - Enhanced Offline Configuration with Network Info
#include <WiFi.h>
#include <WiFiUdp.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// Configuration
const char* ssid = "${config.wifiSSID}";
const char* password = "${config.wifiPassword}";
const char* serverURL = "${config.serverURL}";
const char* esp32_id = "${config.id}";
const char* device_type = "${config.type}";

// Get MAC Address
String getMacAddress() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char macStr[18];
  sprintf(macStr, "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(macStr);
}

// Register with server via WebSocket
void registerWithServer() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String registrationURL = String(serverURL) + "/api/esp32/register";
  http.begin(registrationURL);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<300> doc;
  doc["esp32_id"] = esp32_id;
  doc["mac_address"] = getMacAddress();
  doc["device_type"] = device_type;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["firmware_version"] = "1.0.0";
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpResponseCode = http.POST(requestBody);
  if (httpResponseCode > 0) {
    Serial.println("Registration successful");
  } else {
    Serial.println("Registration failed");
  }
  
  http.end();
}

// Pin Configuration
const int trigPin = ${config.pins?.trigPin ?? 5};
const int echoPin = ${config.pins?.echoPin ?? 18};
${config.pins?.floatPin ? `const int floatPin = ${config.pins.floatPin};` : ''}
${isMotorController ? `const int motorRelay = ${config.pins?.relayPin ?? 2};` : ''}
${isMotorController ? `const int buzzerPin = 25; // Buzzer for alarms` : ''}
${isMotorController ? `const int redLedPin = 26; // Red LED - sump empty` : ''}
${isMotorController ? `const int greenLedPin = 27; // Green LED - sump full` : ''}

// Tank Configuration
const float tankHeight = ${config.tankHeight}; // cm
const float sensorOffset = ${config.sensorOffset}; // cm from top
const float tankCapacity = ${config.tankCapacity}; // liters
const int autoStartLevel = ${config.autoStartLevel}; // %
const int autoStopLevel = ${config.autoStopLevel}; // %
const unsigned long maxRuntime = ${config.maxRuntime * 60000}; // milliseconds
const unsigned long safetyTimeout = ${config.safetyTimeout * 1000}; // milliseconds

// UDP Communication
WiFiUDP udp;
const unsigned int udpPort = 4210; // Custom port for ESP32-to-ESP32 comm
IPAddress broadcastIP(255, 255, 255, 255);

// Global Variables
${isMotorController ? `
bool motorRunning = false;
unsigned long motorStartTime = 0;
unsigned long lastServerContact = 0;
bool serverConnected = false;
bool alarmActive = false;
unsigned long alarmStartTime = 0;
unsigned long lastFillingDetected = 0;
bool sumpFull = false;
bool sumpEmpty = true;
Preferences preferences;
` : `
bool tankFull = false;
bool tankLow = false;
unsigned long lastBroadcastTime = 0;
`}

void setup() {
  Serial.begin(115200);
  
  // Pin setup
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  ${config.pins?.floatPin ? `pinMode(floatPin, INPUT_PULLUP);` : ''}
  ${isMotorController ? `
  pinMode(motorRelay, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  pinMode(redLedPin, OUTPUT);
  pinMode(greenLedPin, OUTPUT);
  digitalWrite(motorRelay, LOW); // Motor off initially
  digitalWrite(buzzerPin, LOW); // Buzzer off
  digitalWrite(redLedPin, HIGH); // Red LED on (sump empty initially)
  digitalWrite(greenLedPin, LOW); // Green LED off

  // Initialize preferences
  preferences.begin("motor_ctrl", false);
  ` : ''}
  
  // WiFi connection
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  
  int wifiTimeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifiTimeout < 30) {
    delay(1000);
    Serial.print(".");
    wifiTimeout++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("MAC address: ");
    Serial.println(getMacAddress());
    
    // Register with server
    registerWithServer();
    
    // Start UDP for ESP32-to-ESP32 communication
    udp.begin(udpPort);
    Serial.println("UDP communication started");
  } else {
    Serial.println("\\nWiFi connection failed - operating in standalone mode");
  }
}

void loop() {
  // Read sensors
  float distance = getDistance();
  float level = calculateLevel(distance);
  ${config.pins?.floatPin ? `bool floatStatus = !digitalRead(floatPin);` : 'bool floatStatus = false;'}
  
  ${isMotorController ? `
  // Sump ESP32 Logic
  handleSumpLogic(level, floatStatus);
  updateLEDs(level, floatStatus);
  handleAlarm(level);
  
  // Check for tank ESP32 messages
  checkUDPMessages();
  
  // Standalone motor control logic
  standaloneMotorControl(level, floatStatus);
  
  // Send data to server if connected
  if (WiFi.status() == WL_CONNECTED) {
    sendSensorData(level, floatStatus);
    sendMotorStatus();
    broadcastSumpStatus(level, floatStatus);
  }
  ` : `
  // Tank ESP32 Logic
  handleTankLogic(level, floatStatus);
  
  // Check for sump ESP32 messages
  checkUDPMessages();
  
  // Send data to server if connected
  if (WiFi.status() == WL_CONNECTED) {
    sendSensorData(level, floatStatus);
    broadcastTankStatus(level, floatStatus);
  }
  `}
  
  // Safety checks and local logging
  performSafetyChecks(level, floatStatus);
  
  delay(2000); // 2-second update cycle
}

float getDistance() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout
  if (duration == 0) {
    Serial.println("Sensor timeout");
    return -1;
  }
  
  return duration * 0.034 / 2; // Convert to cm
}

float calculateLevel(float distance) {
  if (distance < 0) return -1; // Sensor error
  
  float waterLevel = tankHeight - distance - sensorOffset;
  float percentage = max(0.0, min(100.0, (waterLevel / tankHeight) * 100));
  
  return percentage;
}

${isMotorController ? `
// Sump ESP32 specific functions
void handleSumpLogic(float level, bool floatStatus) {
  // Update sump status
  sumpEmpty = (level < 10) || !floatStatus;
  sumpFull = (level > 90);
  
  // Detect if water is being added to sump
  static float lastLevel = level;
  if (level > lastLevel + 2) { // Level increased by more than 2%
    lastFillingDetected = millis();
    Serial.println("Filling detected in sump");
  }
  lastLevel = level;
}

void updateLEDs(float level, bool floatStatus) {
  if (sumpEmpty) {
    digitalWrite(redLedPin, HIGH);   // Red LED on
    digitalWrite(greenLedPin, LOW);  // Green LED off
  } else if (sumpFull) {
    digitalWrite(redLedPin, LOW);    // Red LED off
    digitalWrite(greenLedPin, HIGH); // Green LED on
  } else {
    digitalWrite(redLedPin, LOW);    // Red LED off
    digitalWrite(greenLedPin, LOW);  // Green LED off
  }
}

void handleAlarm(float level) {
  unsigned long currentTime = millis();
  
  if (sumpFull && !alarmActive) {
    // Start alarm when sump becomes full
    alarmActive = true;
    alarmStartTime = currentTime;
    digitalWrite(buzzerPin, HIGH);
    Serial.println("ALARM: Sump is full!");
  }
  
  if (alarmActive) {
    // Check if 1 minute has passed
    if (currentTime - alarmStartTime > 60000) { // 1 minute
      // Check if still filling after 1 minute
      if (currentTime - lastFillingDetected < 5000) { // Still filling in last 5 seconds
        // Intensify alarm (faster beeping)
        static unsigned long lastBeep = 0;
        if (currentTime - lastBeep > 200) { // Faster beep
          digitalWrite(buzzerPin, !digitalRead(buzzerPin));
          lastBeep = currentTime;
        }
        Serial.println("ALARM: Still filling after 1 minute!");
      } else {
        // Stop alarm if no more filling detected
        digitalWrite(buzzerPin, LOW);
        alarmActive = false;
        Serial.println("Alarm stopped - no more filling detected");
      }
    } else {
      // Normal alarm for first minute (slower beeping)
      static unsigned long lastBeep = 0;
      if (currentTime - lastBeep > 500) { // Slower beep
        digitalWrite(buzzerPin, !digitalRead(buzzerPin));
        lastBeep = currentTime;
      }
    }
  }
}

void broadcastSumpStatus(float level, bool floatStatus) {
  StaticJsonDocument<200> doc;
  doc["type"] = "sump_status";
  doc["esp32_id"] = esp32_id;
  doc["level"] = level;
  doc["float_status"] = floatStatus;
  doc["sump_empty"] = sumpEmpty;
  doc["sump_full"] = sumpFull;
  doc["alarm_active"] = alarmActive;
  
  String message;
  serializeJson(doc, message);
  
  udp.beginPacket(broadcastIP, udpPort);
  udp.print(message);
  udp.endPacket();
  
  Serial.println("Sump status broadcasted");
}
` : `
// Tank ESP32 specific functions
void handleTankLogic(float level, bool floatStatus) {
  // Update tank status
  tankLow = (level < autoStartLevel);
  tankFull = (level > autoStopLevel);
  
  // Broadcast tank status every 5 seconds
  if (millis() - lastBroadcastTime > 5000) {
    broadcastTankStatus(level, floatStatus);
    lastBroadcastTime = millis();
  }
}

void broadcastTankStatus(float level, bool floatStatus) {
  StaticJsonDocument<200> doc;
  doc["type"] = "tank_status";
  doc["esp32_id"] = esp32_id;
  doc["level"] = level;
  doc["float_status"] = floatStatus;
  doc["tank_low"] = tankLow;
  doc["tank_full"] = tankFull;
  
  String message;
  serializeJson(doc, message);
  
  udp.beginPacket(broadcastIP, udpPort);
  udp.print(message);
  udp.endPacket();
  
  Serial.println("Tank status broadcasted");
}
`}

void checkUDPMessages() {
  int packetSize = udp.parsePacket();
  if (packetSize) {
    char packetBuffer[255];
    int len = udp.read(packetBuffer, 255);
    if (len > 0) {
      packetBuffer[len] = 0;
    }
    
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, packetBuffer);
    
    if (!error) {
      String messageType = doc["type"];
      
      ${isMotorController ? `
      // Sump ESP32 receiving tank status
      if (messageType == "tank_status") {
        float tankLevel = doc["level"];
        bool tankLow = doc["tank_low"];
        bool tankFull = doc["tank_full"];
        
        Serial.print("Received tank status - Level: ");
        Serial.print(tankLevel);
        Serial.print("%, Low: ");
        Serial.print(tankLow ? "YES" : "NO");
        Serial.print(", Full: ");
        Serial.println(tankFull ? "YES" : "NO");
        
        // Control motor based on tank status
        if (tankFull && motorRunning) {
          controlMotor(false);
          Serial.println("Motor stopped: Tank is full");
        } else if (tankLow && !motorRunning && !sumpEmpty) {
          controlMotor(true);
          Serial.println("Motor started: Tank needs water");
        }
      }
      ` : `
      // Tank ESP32 receiving sump status
      if (messageType == "sump_status") {
        bool sumpEmpty = doc["sump_empty"];
        bool sumpFull = doc["sump_full"];
        bool alarmActive = doc["alarm_active"];
        
        Serial.print("Received sump status - Empty: ");
        Serial.print(sumpEmpty ? "YES" : "NO");
        Serial.print(", Full: ");
        Serial.print(sumpFull ? "YES" : "NO");
        Serial.print(", Alarm: ");
        Serial.println(alarmActive ? "ACTIVE" : "OFF");
        
        // Store sump status for decision making
        // This can be used for enhanced tank logic
      }
      `}
    }
  }
}

${isMotorController ? `
void standaloneMotorControl(float level, bool floatStatus) {
  unsigned long currentTime = millis();
  
  // Safety: Stop motor if running too long
  if (motorRunning && (currentTime - motorStartTime) > maxRuntime) {
    controlMotor(false);
    Serial.println("Motor stopped: Max runtime exceeded");
    return;
  }
  
  // Safety: Don't start if no water in sump
  if (!floatStatus && level < 10) {
    if (motorRunning) {
      controlMotor(false);
      Serial.println("Motor stopped: No water in sump");
    }
    return;
  }
  
  // Auto control logic (works without server)
  if (!motorRunning && level >= autoStartLevel) {
    controlMotor(true);
    Serial.println("Motor started: Auto mode - level high enough");
  }
  
  if (motorRunning && (level <= autoStopLevel || level >= 95)) {
    controlMotor(false);
    Serial.println("Motor stopped: Auto mode - level reached target");
  }
}

void controlMotor(bool start) {
  if (start && !motorRunning) {
    digitalWrite(motorRelay, HIGH);
    motorRunning = true;
    motorStartTime = millis();
    preferences.putULong("lastStart", motorStartTime);
    Serial.println("MOTOR STARTED");
  } else if (!start && motorRunning) {
    digitalWrite(motorRelay, LOW);
    motorRunning = false;
    preferences.putULong("runtime", preferences.getULong("runtime", 0) + (millis() - motorStartTime));
    Serial.println("MOTOR STOPPED");
  }
}

void checkServerConnection() {
  unsigned long currentTime = millis();
  if (currentTime - lastServerContact > safetyTimeout) {
    serverConnected = false;
  }
}

void sendMotorStatus() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(String(serverURL) + "/api/esp32/motor-status");
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<300> doc;
  doc["esp32_id"] = esp32_id;
  doc["motor_running"] = motorRunning;
  doc["power_detected"] = true;
  doc["current_draw"] = 2.3;
  doc["runtime_seconds"] = motorRunning ? (millis() - motorStartTime) / 1000 : 0;
  doc["standalone_mode"] = !serverConnected;
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpResponseCode = http.POST(requestBody);
  if (httpResponseCode > 0) {
    lastServerContact = millis();
    serverConnected = true;
  }
  
  http.end();
}
` : ''}

void sendSensorData(float level, bool floatStatus) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(String(serverURL) + "/api/esp32/sensor-data");
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<400> doc;
  doc["tank_type"] = device_type;
  doc["level_percentage"] = level;
  doc["level_liters"] = (level / 100.0) * tankCapacity;
  doc["sensor_health"] = level >= 0 ? "online" : "offline";
  doc["esp32_id"] = esp32_id;
  doc["battery_voltage"] = 3.7; // Replace with actual battery reading
  doc["signal_strength"] = WiFi.RSSI();
  doc["float_switch"] = floatStatus;
  doc["uptime"] = millis() / 1000;
  
  ${isMotorController ? `
  // Sump-specific data
  doc["sump_empty"] = sumpEmpty;
  doc["sump_full"] = sumpFull;
  doc["alarm_active"] = alarmActive;
  doc["motor_running"] = motorRunning;
  ` : `
  // Tank-specific data
  doc["tank_low"] = tankLow;
  doc["tank_full"] = tankFull;
  `}
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpResponseCode = http.POST(requestBody);
  if (httpResponseCode > 0) {
    ${isMotorController ? 'lastServerContact = millis(); serverConnected = true;' : ''}
    String response = http.getString();
    Serial.println("Server response: " + response);
  }
  
  http.end();
}

void performSafetyChecks(float level, bool floatStatus) {
  // Local safety logging
  if (level < 0) {
    Serial.println("WARNING: Sensor malfunction detected");
  }
  
  ${config.pins?.floatPin ? `
  if (!floatStatus) {
    Serial.println("WARNING: Float switch indicates low water");
  }
  ` : ''}
  
  ${isMotorController ? `
  if (motorRunning && (millis() - motorStartTime) > (maxRuntime * 0.9)) {
    Serial.println("WARNING: Motor approaching max runtime");
  }
  ` : ''}
}`;
  };

  const downloadConfig = (config: ESP32Config) => {
    const code = generateArduinoCode(config);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.id}_config.ino`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Arduino Code Downloaded",
      description: `Configuration for ${config.name} has been downloaded.`,
    });
  };

  const updateConfig = async (updatedConfig: ESP32Config) => {
    const performUpdate = async () => {
      try {
        const deviceId = updatedConfig._id || updatedConfig.id;
        const response = await fetch(`http://localhost:3001/api/esp32/devices/${deviceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedConfig),
        });
        const data = await response.json();
        if (data.success) {
          setConfigs(prev => prev.map(c => c.id === updatedConfig.id ? updatedConfig : c));
          setEditingConfig(null);
          toast({
            title: "Configuration Updated",
            description: `${updatedConfig.name} configuration has been saved.`,
          });
        } else {
          throw new Error(data.error);
        }
      } catch (error) {
        console.error('Error updating device:', error);
        toast({
          title: "Error",
          description: "Failed to update device configuration.",
          variant: "destructive",
        });
      }
    };

    if (onRequestEsp32Update) {
      onRequestEsp32Update(updatedConfig.name, performUpdate);
    } else {
      await performUpdate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">ESP32 Configuration</h2>
        <div className="flex items-center gap-3">
          <Badge variant="outline">
            {configs.length} Device{configs.length !== 1 ? 's' : ''}
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={loadDevices}
            disabled={refreshing}
          >
            <Wifi className="w-4 h-4 mr-2" />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={addNewDevice} className="flex items-center gap-2" disabled={loading}>
            <Wifi className="w-4 h-4" />
            Add Device
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Loading device configurations...</span>
        </div>
      ) : (
        <div className="grid gap-4">
          {configs.length === 0 ? (
            <Card className="p-8 text-center">
              <Wifi className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No ESP32 Devices Configured</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first ESP32 device for tank monitoring and motor control.
                Each device will be uniquely identified by its MAC address when it connects.
              </p>
              <div className="text-sm text-muted-foreground mb-4">
                <p>• Top Tank devices monitor water levels</p>
                <p>• Sump Motor devices control water pumps</p>
                <p>• Devices auto-register with unique MAC addresses</p>
              </div>
              <Button onClick={addNewDevice} className="flex items-center gap-2 mx-auto">
                <Wifi className="w-4 h-4" />
                Add Your First Device
              </Button>
            </Card>
          ) : (
            configs.map((config) => (
          <Card key={config.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {config.type === 'top_tank' ? (
                  <Droplets className="w-6 h-6 text-primary" />
                ) : (
                  <Zap className="w-6 h-6 text-primary" />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{config.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    ID: {config.id} 
                    {config.mac_address && config.mac_address !== 'Unknown' && (
                      <span className="ml-2 font-mono text-xs">
                        • MAC: {config.mac_address}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setEditingConfig(config)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Configure {config.name}</DialogTitle>
                      <DialogDescription>
                        Configure the settings for your ESP32 device including WiFi, pins, and tank parameters.
                      </DialogDescription>
                    </DialogHeader>
                    {editingConfig && !isAddingDevice && (
                      <ConfigEditor 
                        config={editingConfig} 
                        onSave={updateConfig}
                        onCancel={() => setEditingConfig(null)}
                      />
                    )}
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => downloadConfig(config)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Code
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Trigger Pin</p>
                <p className="font-medium">GPIO {config.pins?.trigPin ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Echo Pin</p>
                <p className="font-medium">GPIO {config.pins?.echoPin ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tank Capacity</p>
                <p className="font-medium">{config.tankCapacity}L</p>
              </div>
              <div>
                <p className="text-muted-foreground">Auto Start</p>
                <p className="font-medium">{config.autoStartLevel}%</p>
              </div>
            </div>

            {/* Network Information */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t border-border/50">
              <div>
                <p className="text-muted-foreground">MAC Address</p>
                <p className="font-medium font-mono text-xs">
                  {config.mac_address && config.mac_address !== 'Unknown' 
                    ? config.mac_address 
                    : 'Not registered yet'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">IP Address</p>
                <p className="font-medium font-mono text-xs">
                  {config.current_ip || config.ip_address || 'Not connected'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Connection Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    config.is_connected ? 'bg-success animate-pulse' : 'bg-destructive'
                  }`} />
                  <p className="font-medium capitalize">
                    {config.is_connected ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Last Seen</p>
                <p className="font-medium text-xs">
                  {config.last_seen ? new Date(config.last_seen).toLocaleString() : 'Never'}
                </p>
              </div>
            </div>
          </Card>
            ))
          )}
        </div>
      )}

      {/* Add Device Dialog */}
      <Dialog open={isAddingDevice} onOpenChange={setIsAddingDevice}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New ESP32 Device</DialogTitle>
            <DialogDescription>
              Create a new ESP32 device configuration for tank monitoring and motor control.
            </DialogDescription>
          </DialogHeader>
          {editingConfig && isAddingDevice && (
            <ConfigEditor 
              config={editingConfig} 
              onSave={saveNewDevice}
              onCancel={() => {
                setEditingConfig(null);
                setIsAddingDevice(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ConfigEditor = ({ 
  config, 
  onSave, 
  onCancel 
}: { 
  config: ESP32Config; 
  onSave: (config: ESP32Config) => void;
  onCancel: () => void;
}) => {
  const [editConfig, setEditConfig] = useState<ESP32Config>(config);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Device Name</Label>
          <Input 
            value={editConfig.name}
            onChange={(e) => setEditConfig(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>
        <div>
          <Label>Device Type</Label>
          <Select 
            value={editConfig.type} 
            onValueChange={(value: 'top_tank' | 'sump_motor') => 
              setEditConfig(prev => ({ ...prev, type: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top_tank">Top Tank Sensor</SelectItem>
              <SelectItem value="sump_motor">Sump Motor Control</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>WiFi SSID</Label>
          <Input 
            value={editConfig.wifiSSID}
            onChange={(e) => setEditConfig(prev => ({ ...prev, wifiSSID: e.target.value }))}
          />
        </div>
        <div>
          <Label>WiFi Password</Label>
          <Input 
            type="password"
            value={editConfig.wifiPassword}
            onChange={(e) => setEditConfig(prev => ({ ...prev, wifiPassword: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <Label>Server URL</Label>
        <Input 
          value={editConfig.serverURL}
          onChange={(e) => setEditConfig(prev => ({ ...prev, serverURL: e.target.value }))}
        />
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Pin Configuration</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Trigger Pin</Label>
            <Input
              type="number"
              value={editConfig.pins?.trigPin ?? 5}
              onChange={(e) => setEditConfig(prev => ({
                ...prev,
                pins: { ...prev.pins, trigPin: parseInt(e.target.value) }
              }))}
            />
          </div>
          <div>
            <Label>Echo Pin</Label>
            <Input
              type="number"
              value={editConfig.pins?.echoPin ?? 18}
              onChange={(e) => setEditConfig(prev => ({
                ...prev,
                pins: { ...prev.pins, echoPin: parseInt(e.target.value) }
              }))}
            />
          </div>
          <div>
            <Label>Float Pin (Optional)</Label>
            <Input
              type="number"
              value={editConfig.pins?.floatPin ?? ''}
              onChange={(e) => setEditConfig(prev => ({
                ...prev,
                pins: { ...prev.pins, floatPin: e.target.value ? parseInt(e.target.value) : undefined }
              }))}
            />
          </div>
        </div>

        {editConfig.type === 'sump_motor' && (
          <div>
            <Label>Relay Pin</Label>
            <Input
              type="number"
              value={editConfig.pins?.relayPin ?? 2}
              onChange={(e) => setEditConfig(prev => ({
                ...prev,
                pins: { ...prev.pins, relayPin: parseInt(e.target.value) }
              }))}
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Tank Configuration</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Capacity (Liters)</Label>
            <Input 
              type="number"
              value={editConfig.tankCapacity}
              onChange={(e) => setEditConfig(prev => ({ ...prev, tankCapacity: parseInt(e.target.value) }))}
            />
          </div>
          <div>
            <Label>Height (cm)</Label>
            <Input 
              type="number"
              value={editConfig.tankHeight}
              onChange={(e) => setEditConfig(prev => ({ ...prev, tankHeight: parseInt(e.target.value) }))}
            />
          </div>
          <div>
            <Label>Sensor Offset (cm)</Label>
            <Input 
              type="number"
              value={editConfig.sensorOffset}
              onChange={(e) => setEditConfig(prev => ({ ...prev, sensorOffset: parseInt(e.target.value) }))}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Auto Control Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Auto Start Level (%)</Label>
            <Input 
              type="number"
              value={editConfig.autoStartLevel}
              onChange={(e) => setEditConfig(prev => ({ ...prev, autoStartLevel: parseInt(e.target.value) }))}
            />
          </div>
          <div>
            <Label>Auto Stop Level (%)</Label>
            <Input 
              type="number"
              value={editConfig.autoStopLevel}
              onChange={(e) => setEditConfig(prev => ({ ...prev, autoStopLevel: parseInt(e.target.value) }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Max Runtime (minutes)</Label>
            <Input 
              type="number"
              value={editConfig.maxRuntime}
              onChange={(e) => setEditConfig(prev => ({ ...prev, maxRuntime: parseInt(e.target.value) }))}
            />
          </div>
          <div>
            <Label>Safety Timeout (seconds)</Label>
            <Input 
              type="number"
              value={editConfig.safetyTimeout}
              onChange={(e) => setEditConfig(prev => ({ ...prev, safetyTimeout: parseInt(e.target.value) }))}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button onClick={() => onSave(editConfig)} className="flex-1">
          Save Configuration
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
};
