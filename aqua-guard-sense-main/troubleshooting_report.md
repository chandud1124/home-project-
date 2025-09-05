# AquaGuard Sense Troubleshooting Report

## Issue Summary
The frontend shows a fixed 75% water level for the top tank despite the ESP32 correctly sending approximately 44% level readings.

## Root Cause Analysis

After investigating the codebase, I've identified the following key issues:

1. **Mock Data Override**: The system has mock data in `src/services/mockApi.ts` that shows a fixed 75% level for the top tank. Although `USE_MOCK_API` is set to false in `api.ts`, other issues may be preventing the real data from displaying.

2. **WebSocket Communication**: The frontend appears to show a disconnection status despite the backend WebSocket server (`ws://localhost:8083`) receiving data from the ESP32.

3. **Data Flow Issues**: The tank readings from ESP32 are correctly received by the backend server, processed, and broadcast to frontend clients, but the UI is not reflecting these changes.

## Implementation Details

### Fixed Issues

1. **Mock API Flag**: Confirmed that the `USE_MOCK_API` flag in `src/services/api.ts` is set to `false`. This ensures the system should use real ESP32 data rather than mock data.

2. **Backend WebSocket Processing**: The backend correctly processes ESP32 sensor data and broadcasts it to frontend clients:
   ```javascript
   broadcast({ type: 'tank_reading', data: reading });
   ```

3. **WebSocket Handler Registration**: The frontend correctly registers handlers for WebSocket messages including `tank_reading`:
   ```javascript
   apiService.onWebSocketMessage('tank_reading', (data) => {
     console.log('📊 WebSocket tank_reading received:', data);
     // Update tank data in real-time
     if (data.tank_type === 'top_tank') {
       // Update top tank data
       setTotalWaterLevel(data.level_liters);
       setWaterLevelChange(data.level_percentage > 50 ? 2.5 : -1.8);
       console.log('📊 Updated top tank level:', data.level_percentage, '%');
     }
   });
   ```

### Remaining Issues

1. **WebSocket Reconnection**: The `useWebSocket` hook in the frontend attempts to reconnect every 3 seconds, which may cause state updates that interfere with data processing:
   ```typescript
   ws.current.onclose = () => {
     console.log('WebSocket disconnected');
     setIsConnected(false);
     // Reconnect after 3 seconds
     setTimeout(connect, 3000);
   };
   ```

2. **ESP32 Status Toggling**: There may be rapid toggling between connected and disconnected states because the ESP32 status is updated on each message.

## Next Steps

1. **Check console logs**: Look at the browser's console logs to verify if WebSocket messages with tank readings are being received.

2. **Verify backend server URL**: Ensure the frontend is connecting to the correct WebSocket URL:
   ```javascript
   const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || 'ws://192.168.0.108:8083'
   ```
   
   Make sure this matches your local server IP. You might need to update it to `ws://localhost:8083` if running locally.

3. **Inspect ESP32 status**: Check the ESP32 connection status in the UI to see if it's showing as connected or disconnected.

4. **Review state updates**: The WebSocket handler correctly logs updates but check if the state is being overwritten by other code paths.

5. **Implement additional debugging**: Add more console logs in the WebSocket handlers to track the flow of data:
   ```javascript
   apiService.onWebSocketMessage('tank_reading', (data) => {
     console.log('TANK READING BEFORE UPDATE:', { 
       previous: totalWaterLevel, 
       incoming: data.level_liters, 
       tankType: data.tank_type 
     });
     
     // Update logic here...
     
     console.log('TANK READING AFTER UPDATE:', { 
       updated: totalWaterLevel 
     });
   });
   ```

## Conclusion

The issue appears to be related to WebSocket connection management and state updates in the frontend. The data is correctly sent from the ESP32 to the backend, and the backend is correctly broadcasting it, but there may be issues with the frontend WebSocket connection or state management that prevent the UI from reflecting the updated values.

Check your browser console for WebSocket error messages and ensure you're connecting to the correct WebSocket server URL for your environment.
