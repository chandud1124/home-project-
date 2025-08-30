const express = require('express');
const router = express.Router();

// Enhanced ESP32 endpoints for sensor data and motor control with ESP-NOW support
class ESP32Controller {
  constructor(db, broadcast) {
    this.db = db;
    this.broadcast = broadcast;
    this.motorStatus = {
      isRunning: false,
      lastHeartbeat: null,
      powerBackup: true
    };
    this.deviceStatus = new Map(); // Track device communication modes
    this.pendingEvents = new Map(); // Store events for offline devices
  }

  // Enhanced sensor data handler with dual sensor verification
  handleSensorData = async (req, res) => {
    const {
      tank_type,
      level_percentage,
      level_liters,
      sensor_health,
      esp32_id,
      battery_voltage,
      signal_strength,
      float_switch,
      ultrasonic_valid,
      dual_sensor_agreement,
      motor_running,
      auto_mode,
      communication_mode,
      timestamp
    } = req.body;

    try {
      // Store sensor data with enhanced fields
      const sensorData = {
        esp32_id,
        tank_type,
        level_percentage,
        level_liters,
        sensor_health,
        battery_voltage,
        signal_strength,
        float_switch,
        ultrasonic_valid,
        dual_sensor_agreement,
        motor_running,
        auto_mode,
        communication_mode: communication_mode || 'wifi',
        timestamp: timestamp ? new Date(timestamp) : new Date()
      };

      // Update device status
      this.deviceStatus.set(esp32_id, {
        lastSeen: new Date(),
        communicationMode: communication_mode || 'wifi',
        online: true
      });

      const result = await this.db.collection('tank_readings').insertOne(sensorData);

      // Enhanced notification logic with dual sensor verification
      await this.handleSmartNotifications(sensorData);

      const reading = {
        id: result.insertedId,
        ...sensorData,
        timestamp: sensorData.timestamp.toISOString()
      };

      this.broadcast({ type: 'sensor_data', data: reading });

      // Return enhanced motor command with dual sensor consideration
      res.json({
        success: true,
        motor_command: this.getEnhancedMotorCommand(sensorData),
        config_update: await this.getDeviceConfig(esp32_id),
        reading
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Smart notification system with dual sensor verification
  handleSmartNotifications = async (sensorData) => {
    const { esp32_id, tank_type, level_percentage, dual_sensor_agreement, float_switch } = sensorData;

    // Only create notifications if dual sensors agree (reduces false positives)
    if (!dual_sensor_agreement) {
      console.log(`Dual sensor disagreement for ${esp32_id}, skipping notifications`);
      return;
    }

    // Critical level notifications
    if (tank_type === 'top_tank') {
      if (level_percentage < 15) {
        await this.createNotification({
          type: 'alarm',
          title: 'Top Tank Critical Low',
          message: `Top tank ${esp32_id} is critically low (${level_percentage}%) - Dual sensor confirmed`,
          severity: 'high',
          esp32_id
        });
      } else if (level_percentage < 25) {
        await this.createNotification({
          type: 'warning',
          title: 'Top Tank Low',
          message: `Top tank ${esp32_id} water level is low (${level_percentage}%)`,
          severity: 'medium',
          esp32_id
        });
      }
    } else if (tank_type === 'sump') {
      if (level_percentage < 10) {
        await this.createNotification({
          type: 'alarm',
          title: 'Sump Tank Critical Low',
          message: `Sump tank ${esp32_id} is critically low (${level_percentage}%) - Dual sensor confirmed`,
          severity: 'high',
          esp32_id
        });
      } else if (level_percentage > 90) {
        await this.createNotification({
          type: 'alarm',
          title: 'Sump Tank Overflow Risk',
          message: `Sump tank ${esp32_id} is at high risk of overflow (${level_percentage}%)`,
          severity: 'high',
          esp32_id
        });
      }
    }
  };

  // Enhanced motor command with dual sensor verification
  getEnhancedMotorCommand = (sensorData) => {
    const { tank_type, level_percentage, dual_sensor_agreement, motor_running } = sensorData;

    // Only issue commands if dual sensors agree
    if (!dual_sensor_agreement) {
      return { command: 'maintain', reason: 'dual_sensor_verification_pending' };
    }

    if (tank_type === 'top_tank') {
      // Enhanced logic for top tank
      if (level_percentage < 20) {
        return { command: 'start', reason: 'auto_fill_critical_low' };
      } else if (level_percentage > 90) {
        return { command: 'stop', reason: 'auto_fill_tank_full' };
      }
    } else if (tank_type === 'sump') {
      // Enhanced logic for sump tank
      if (level_percentage < 15) {
        return { command: 'stop', reason: 'sump_critical_low' };
      } else if (level_percentage > 95) {
        return { command: 'stop', reason: 'sump_overflow_protection' };
      }
    }

    return { command: 'maintain', reason: 'normal_operation' };
  };

  // Handle ESP-NOW messages (direct device-to-device)
  handleESPNowMessage = async (req, res) => {
    const { esp32_id, message_type, payload, timestamp } = req.body;

    try {
      // Store ESP-NOW message for processing
      const espNowData = {
        esp32_id,
        message_type,
        payload,
        communication_mode: 'esp_now',
        timestamp: timestamp ? new Date(timestamp) : new Date()
      };

      await this.db.collection('esp_now_messages').insertOne(espNowData);

      // Process different ESP-NOW message types
      switch (message_type) {
        case 'emergency_stop':
          await this.handleEmergencyStop(esp32_id, payload);
          break;
        case 'manual_override':
          await this.handleManualOverride(esp32_id, payload);
          break;
        case 'config_request':
          // Send configuration update via ESP-NOW
          break;
      }

      // Update device status
      this.deviceStatus.set(esp32_id, {
        lastSeen: new Date(),
        communicationMode: 'esp_now',
        online: true
      });

      res.json({ success: true, acknowledged: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Handle emergency stop from ESP-NOW
  handleEmergencyStop = async (esp32_id, payload) => {
    await this.createNotification({
      type: 'alarm',
      title: 'Emergency Stop Activated',
      message: `Emergency stop activated on ${esp32_id}: ${payload.reason}`,
      severity: 'high',
      esp32_id
    });

    // Broadcast emergency stop to all connected clients
    this.broadcast({
      type: 'emergency_stop',
      data: { esp32_id, reason: payload.reason, timestamp: new Date() }
    });
  };

  // Handle manual override from ESP-NOW
  handleManualOverride = async (esp32_id, payload) => {
    await this.createNotification({
      type: 'info',
      title: 'Manual Override',
      message: `Manual override activated on ${esp32_id}: ${payload.action}`,
      severity: 'medium',
      esp32_id
    });

    this.broadcast({
      type: 'manual_override',
      data: { esp32_id, action: payload.action, timestamp: new Date() }
    });
  };

  // Get device-specific configuration
  getDeviceConfig = async (esp32_id) => {
    try {
      const config = await this.db.collection('device_config').findOne({ esp32_id });
      return config || {
        alarm_volume: 80,
        alarm_timeout: 30000,
        auto_start_level: 30,
        auto_stop_level: 85
      };
    } catch (err) {
      console.error('Error getting device config:', err);
      return null;
    }
  };

  // Update device configuration
  updateDeviceConfig = async (req, res) => {
    const { esp32_id, config } = req.body;

    try {
      await this.db.collection('device_config').updateOne(
        { esp32_id },
        { $set: { ...config, last_updated: new Date() } },
        { upsert: true }
      );

      // Broadcast config update to device
      this.broadcast({
        type: 'config_update',
        data: { esp32_id, config }
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Sync stored events from offline devices
  syncDeviceEvents = async (req, res) => {
    const { esp32_id, events } = req.body;

    try {
      const syncedEvents = [];

      for (const event of events) {
        const eventData = {
          esp32_id,
          ...event,
          synced_at: new Date(),
          communication_mode: 'sync'
        };

        await this.db.collection('device_events').insertOne(eventData);
        syncedEvents.push(eventData);
      }

      res.json({ success: true, synced_count: syncedEvents.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Enhanced heartbeat with communication mode tracking
  handleHeartbeat = async (req, res) => {
    const {
      esp32_id,
      battery_level,
      wifi_strength,
      uptime,
      communication_mode,
      motor_status,
      auto_mode
    } = req.body;

    try {
      // Update device status
      this.deviceStatus.set(esp32_id, {
        lastSeen: new Date(),
        communicationMode: communication_mode || 'wifi',
        online: true,
        motorStatus: motor_status,
        autoMode: auto_mode
      });

      await this.db.collection('system_status').insertOne({
        esp32_id,
        battery_level,
        wifi_strength,
        uptime,
        communication_mode: communication_mode || 'wifi',
        motor_status,
        auto_mode,
        timestamp: new Date()
      });

      res.json({
        success: true,
        server_time: new Date().toISOString(),
        config_update: await this.getDeviceConfig(esp32_id)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Get device status for monitoring
  getDeviceStatus = async (req, res) => {
    try {
      const devices = Array.from(this.deviceStatus.entries()).map(([esp32_id, status]) => ({
        esp32_id,
        ...status
      }));

      res.json({ success: true, devices });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Create notification for system events
  createNotification = async (notificationData) => {
    try {
      const notification = {
        ...notificationData,
        timestamp: new Date(),
        read: false
      };

      await this.db.collection('notifications').insertOne(notification);

      // Broadcast notification to connected clients
      this.broadcast({
        type: 'notification',
        data: notification
      });

      console.log(`Notification created: ${notification.title}`);
    } catch (err) {
      console.error('Error creating notification:', err);
    }
  };
}

module.exports = ESP32Controller;
