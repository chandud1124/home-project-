import React, { useState, useEffect, useRef } from 'react';

interface SystemStatus {
  wifi_connected: boolean;
  battery_level: number;
  temperature: number;
  esp32_top_status: string;
  esp32_sump_status: string;
  wifi_strength: number;
  timestamp: string;
}

interface TankReading {
  id: string;
  tank_type: string;
  level_percentage: number;
  level_liters: number;
  sensor_health: string;
  esp32_id: string;
  signal_strength: number;
  timestamp: string;
  float_switch?: boolean;
  motor_running?: boolean;
  manual_override?: boolean;
}

function App() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [tankReadings, setTankReadings] = useState<TankReading[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket('ws://192.168.0.108:8083');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket');
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received:', data);

        if (data.type === 'system_status') {
          setSystemStatus(data.data);
        } else if (data.type === 'tank_reading') {
          setTankReadings(prev => {
            const newReadings = [...prev];
            const existingIndex = newReadings.findIndex(r => r.esp32_id === data.data.esp32_id);

            if (existingIndex >= 0) {
              newReadings[existingIndex] = data.data;
            } else {
              newReadings.push(data.data);
            }

            return newReadings.slice(-10); // Keep last 10 readings
          });
        } else if (data.type === 'auto_mode_status') {
          console.log('Auto mode status confirmed:', data.enabled);
        } else if (data.type === 'manual_override_status') {
          console.log('Manual override status confirmed:', data.active);
        } else if (data.type === 'motor_control_error') {
          console.error('Motor control error:', data.message);
          alert(`Motor Control Error: ${data.message}`);
        }

        setLastUpdate(new Date());
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  const getSumpTankData = () => {
    return tankReadings.find(reading => reading.tank_type === 'sump_tank') || null;
  };

  const sumpData = getSumpTankData();

  const sendMotorCommand = (state: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const command = {
        type: 'motor_control',
        state: state
      };
      wsRef.current.send(JSON.stringify(command));
      console.log('Sent motor command:', command);
    } else {
      console.error('WebSocket not connected');
    }
  };

  const sendAutoModeCommand = (enabled: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const command = {
        type: 'auto_mode_control',
        enabled: enabled
      };
      wsRef.current.send(JSON.stringify(command));
      console.log('Sent auto mode command:', command);
    } else {
      console.error('WebSocket not connected');
    }
  };

  const sendResetManualCommand = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const command = {
        type: 'reset_manual'
      };
      wsRef.current.send(JSON.stringify(command));
      console.log('Sent reset manual command:', command);
    } else {
      console.error('WebSocket not connected');
    }
  };

  const getStatusColor = (status: boolean) => status ? '#10b981' : '#ef4444';
  const getBadgeStyle = (variant: string) => {
    switch (variant) {
      case 'default': return { backgroundColor: '#3b82f6', color: 'white' };
      case 'destructive': return { backgroundColor: '#ef4444', color: 'white' };
      case 'secondary': return { backgroundColor: '#6b7280', color: 'white' };
      default: return { backgroundColor: '#e5e7eb', color: '#374151' };
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '16px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
            Aqua Guard Sense - Tank Monitor
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span
              style={{
                ...getBadgeStyle(wsConnected ? 'default' : 'destructive'),
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}
            >
              {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
            {lastUpdate && (
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px'
        }}>
          {/* System Status Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
                System Status
              </h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>WiFi:</span>
                  <span
                    style={{
                      ...getBadgeStyle(systemStatus?.wifi_connected ? 'default' : 'destructive'),
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}
                  >
                    {systemStatus?.wifi_connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>ESP32 Sump:</span>
                  <span
                    style={{
                      ...getBadgeStyle(systemStatus?.esp32_sump_status === 'online' ? 'default' : 'secondary'),
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}
                  >
                    {systemStatus?.esp32_sump_status || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sump Tank Status Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
                Sump Tank Status
              </h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Water Level */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Water Level</span>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {sumpData ? `${sumpData.level_percentage.toFixed(1)}%` : '--'}
                    </span>
                  </div>
                  <div style={{
                    height: '12px',
                    width: '100%',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '9999px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${sumpData?.level_percentage || 0}%`,
                      backgroundColor: '#3b82f6',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* Float Switch Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Float Switch:</span>
                  <span
                    style={{
                      ...getBadgeStyle(sumpData?.float_switch ? 'default' : 'destructive'),
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}
                  >
                    {sumpData?.float_switch ? 'Water Detected' : 'No Water'}
                  </span>
                </div>

                {/* Manual Override Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Manual Override:</span>
                  <span
                    style={{
                      ...getBadgeStyle(sumpData?.manual_override ? 'destructive' : 'default'),
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}
                  >
                    {sumpData?.manual_override ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Volume */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Volume:</span>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {sumpData ? `${sumpData.level_liters.toFixed(1)}L` : '--'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Motor Control Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
                Motor Control
              </h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Emergency Stop Button */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to perform an EMERGENCY STOP? This will immediately stop the motor.')) {
                        sendMotorCommand(false);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 8px rgba(220,38,38,0.15)',
                      cursor: 'pointer',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-stop w-4 h-4 mr-2"><circle cx="12" cy="12" r="10"></circle><rect x="9" y="9" width="6" height="6" rx="1"></rect></svg>
                      Emergency Stop
                    </span>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => sendMotorCommand(true)}
                    disabled={!sumpData?.float_switch}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: !sumpData?.float_switch ? '#d1d5db' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: !sumpData?.float_switch ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Start Motor
                  </button>
                  <button
                    onClick={() => sendMotorCommand(false)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Stop Motor
                  </button>
                </div>

                {/* Reset Manual Override Button */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => sendResetManualCommand()}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Reset Manual Override
                  </button>
                </div>

                {!sumpData?.float_switch && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px'
                  }}>
                    <span style={{ color: '#dc2626' }}>⚠️</span>
                    <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>
                      Cannot start motor - No water in sump tank!
                    </span>
                  </div>
                )}

                {sumpData?.manual_override && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: '6px'
                  }}>
                    <span style={{ color: '#d97706' }}>⚠️</span>
                    <span style={{ fontSize: '0.875rem', color: '#d97706' }}>
                      Manual override active - Remote control disabled. Use "Reset Manual Override" to regain remote control.
                    </span>
                  </div>
                )}

                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Motor will only start if float switch detects water (safety feature)
                </div>
              </div>
            </div>
          </div>

          {/* Auto Mode Control Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
                Auto Mode Control
              </h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => sendAutoModeCommand(true)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Enable Auto Mode
                  </button>
                  <button
                    onClick={() => sendAutoModeCommand(false)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Disable Auto Mode
                  </button>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Auto mode automatically controls the motor based on water levels and safety conditions
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Readings */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          marginTop: '24px'
        }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
              Recent Tank Readings
            </h2>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tankReadings.slice(-5).reverse().map((reading, index) => (
                <div key={reading.id || index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span
                      style={{
                        ...getBadgeStyle('outline'),
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}
                    >
                      {reading.tank_type}
                    </span>
                    <span style={{ fontWeight: '500' }}>{reading.level_percentage.toFixed(1)}%</span>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Float: {reading.float_switch ? 'ON' : 'OFF'}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Motor: {reading.motor_running ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {new Date(reading.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              {tankReadings.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  padding: '32px'
                }}>
                  No tank readings received yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;