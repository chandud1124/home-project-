
const express = require('express');
const router = express.Router();

// ESP32 endpoints for sensor data and motor control
class ESP32Controller {
  constructor(db, broadcast) {
    this.db = db;
    this.broadcast = broadcast;
    this.motorStatus = {
      isRunning: false,
      lastHeartbeat: null,
      powerBackup: true
    };
  }

  // ESP32 sends sensor readings
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
      uptime,
      sump_empty,
      sump_full,
      alarm_active,
      motor_running,
      tank_low,
      tank_full
    } = req.body;
    
    try {
      // Store sensor data
      const sensorData = {
        esp32_id,
        tank_type,
        level_percentage,
        level_liters,
        sensor_health,
        battery_voltage,
        signal_strength,
        float_switch,
        uptime,
        timestamp: new Date()
      };
      
      // Add device-specific data
      if (tank_type === 'sump_motor') {
        sensorData.sump_empty = sump_empty;
        sensorData.sump_full = sump_full;
        sensorData.alarm_active = alarm_active;
        sensorData.motor_running = motor_running;
      } else if (tank_type === 'top_tank') {
        sensorData.tank_low = tank_low;
        sensorData.tank_full = tank_full;
      }
      
      const result = await this.db.collection('tank_readings').insertOne(sensorData);
      
      // Create notifications for critical events
      if (alarm_active) {
        await this.createNotification({
          type: 'alarm',
          title: 'Sump Alarm Active',
          message: `Sump ${esp32_id} is full and alarm is sounding`,
          severity: 'high',
          esp32_id
        });
      }
      
      if (sump_full && !alarm_active) {
        await this.createNotification({
          type: 'warning',
          title: 'Sump Full',
          message: `Sump ${esp32_id} has reached maximum capacity`,
          severity: 'medium',
          esp32_id
        });
      }
      
      if (tank_full) {
        await this.createNotification({
          type: 'info',
          title: 'Tank Full',
          message: `Tank ${esp32_id} is at maximum capacity`,
          severity: 'low',
          esp32_id
        });
      }
      
      if (tank_low) {
        await this.createNotification({
          type: 'warning',
          title: 'Tank Low',
          message: `Tank ${esp32_id} water level is low`,
          severity: 'medium',
          esp32_id
        });
      }
      
      const reading = {
        id: result.insertedId,
        ...sensorData,
        timestamp: new Date().toISOString()
      };
      
      this.broadcast({ type: 'sensor_data', data: reading });
      res.json({ 
        success: true, 
        motor_command: this.getMotorCommand(level_percentage, tank_type),
        reading 
      });
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

  // ESP32 reports motor status (with power detection)
  handleMotorStatus = async (req, res) => {
    const { 
      esp32_id, 
      motor_running, 
      power_detected, 
      current_draw,
      runtime_seconds 
    } = req.body;
    this.motorStatus = {
      isRunning: motor_running,
      powerDetected: power_detected,
      lastHeartbeat: new Date(),
      currentDraw: current_draw,
      runtime: runtime_seconds
    };
    try {
      await this.db.collection('motor_events').insertOne({
        event_type: motor_running ? 'motor_started' : 'motor_stopped',
        duration: runtime_seconds,
        esp32_id: esp32_id,
        motor_running: motor_running,
        power_detected: power_detected,
        current_draw: current_draw,
        timestamp: new Date()
      });
      this.broadcast({ 
        type: 'motor_status', 
        data: {
          esp32_id: esp32_id,
          motor_running: motor_running,
          power_detected: power_detected,
          current_draw: current_draw,
          runtime: runtime_seconds,
          timestamp: new Date().toISOString()
        }
      });
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Get motor command based on tank levels and settings
  getMotorCommand = (topTankLevel, sumpLevel) => {
    // Auto mode logic
    if (topTankLevel < 20 && sumpLevel > 30) {
      return { command: 'start', reason: 'auto_fill_low_tank' };
    }
    if (topTankLevel > 90 || sumpLevel < 20) {
      return { command: 'stop', reason: 'safety_cutoff' };
    }
    return { command: 'maintain', reason: 'normal_operation' };
  };

  // ESP32 heartbeat
  handleHeartbeat = async (req, res) => {
    const { esp32_id, battery_level, wifi_strength, uptime } = req.body;
    try {
      await this.db.collection('system_status').insertOne({
        esp32_top_status: 'online',
        esp32_sump_status: 'online',
        battery_level,
        wifi_connected: true,
        temperature: 25,
        timestamp: new Date()
      });
      res.json({ 
        success: true, 
        server_time: new Date().toISOString(),
        motor_command: this.motorStatus.isRunning ? 'maintain' : 'standby'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

module.exports = ESP32Controller;
