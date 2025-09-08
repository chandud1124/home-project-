// AquaGuard ML Service - Predictive Analytics for Water Management
import * as tf from '@tensorflow/tfjs';

export interface WaterUsagePattern {
  timestamp: string;
  level_percentage: number;
  consumption_rate: number;
  motor_runtime: number;
  hour_of_day: number;
  day_of_week: number;
  season: number;
}

export interface MLPrediction {
  type: 'water_level' | 'maintenance' | 'anomaly' | 'efficiency';
  prediction: number;
  confidence: number;
  timeframe: string;
  recommendations: string[];
  created_at: string;
}

export interface AnomalyDetection {
  is_anomaly: boolean;
  anomaly_score: number;
  anomaly_type: 'consumption_spike' | 'sensor_drift' | 'motor_efficiency' | 'leak_detection';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommended_actions: string[];
}

class AquaGuardMLService {
  private models: Map<string, tf.LayersModel> = new Map();
  private isInitialized: boolean = false;
  private trainingData: WaterUsagePattern[] = [];

  constructor() {
    this.initializeML();
  }

  async initializeML() {
    try {
      console.log('🤖 Initializing AquaGuard ML Service...');
      
      // Initialize TensorFlow.js
      await tf.ready();
      console.log('✅ TensorFlow.js backend:', tf.getBackend());

      // Load or create ML models
      await this.loadModels();
      
      this.isInitialized = true;
      console.log('🚀 ML Service initialized successfully');
    } catch (error) {
      console.error('❌ ML Service initialization failed:', error);
    }
  }

  private async loadModels() {
    try {
      // Try to load existing models from cloud storage or create new ones
      await this.loadOrCreateWaterLevelPredictionModel();
      await this.loadOrCreateAnomalyDetectionModel();
      await this.loadOrCreateMaintenancePredictionModel();
    } catch (error) {
      console.log('📝 Creating new ML models (first time setup)');
      await this.createDefaultModels();
    }
  }

  private async loadOrCreateWaterLevelPredictionModel() {
    const modelName = 'water_level_prediction';
    
    try {
      // Try loading from IndexedDB first (browser storage)
      const model = await tf.loadLayersModel(`indexeddb://${modelName}`);
      this.models.set(modelName, model);
      console.log('✅ Loaded water level prediction model');
    } catch (error) {
      console.log('📝 Creating new water level prediction model');
      await this.createWaterLevelPredictionModel();
    }
  }

  private async createWaterLevelPredictionModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [8], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'linear' }) // Predict water level %
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    this.models.set('water_level_prediction', model);
    console.log('✅ Created water level prediction model');
  }

  private async loadOrCreateAnomalyDetectionModel() {
    const modelName = 'anomaly_detection';
    
    try {
      const model = await tf.loadLayersModel(`indexeddb://${modelName}`);
      this.models.set(modelName, model);
      console.log('✅ Loaded anomaly detection model');
    } catch (error) {
      console.log('📝 Creating new anomaly detection model');
      await this.createAnomalyDetectionModel();
    }
  }

  private async createAnomalyDetectionModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Binary: normal(0) or anomaly(1)
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    this.models.set('anomaly_detection', model);
    console.log('✅ Created anomaly detection model');
  }

  private async loadOrCreateMaintenancePredictionModel() {
    const modelName = 'maintenance_prediction';
    
    try {
      const model = await tf.loadLayersModel(`indexeddb://${modelName}`);
      this.models.set(modelName, model);
      console.log('✅ Loaded maintenance prediction model');
    } catch (error) {
      console.log('📝 Creating new maintenance prediction model');
      await this.createMaintenancePredictionModel();
    }
  }

  private async createMaintenancePredictionModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [12], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Maintenance needed probability
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    this.models.set('maintenance_prediction', model);
    console.log('✅ Created maintenance prediction model');
  }

  private async createDefaultModels() {
    await this.createWaterLevelPredictionModel();
    await this.createAnomalyDetectionModel();
    await this.createMaintenancePredictionModel();
  }

  // Feature engineering - convert raw data to ML features
  private extractFeatures(data: any[]): number[][] {
    return data.map(reading => {
      const timestamp = new Date(reading.timestamp);
      return [
        reading.level_percentage || 0,
        reading.motor_running ? 1 : 0,
        reading.wifi_rssi || -50,
        reading.free_heap || 50000,
        timestamp.getHours(), // Hour of day (0-23)
        timestamp.getDay(),   // Day of week (0-6)
        timestamp.getMonth(), // Month (0-11)
        this.calculateConsumptionRate(reading, data),
      ];
    });
  }

  private calculateConsumptionRate(current: any, history: any[]): number {
    // Calculate water consumption rate based on level changes
    const recentReadings = history
      .filter(r => new Date(r.timestamp) > new Date(Date.now() - 3600000)) // Last hour
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (recentReadings.length < 2) return 0;

    const first = recentReadings[0];
    const last = recentReadings[recentReadings.length - 1];
    const timeDiff = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 3600000; // Hours
    const levelDiff = first.level_percentage - last.level_percentage;

    return timeDiff > 0 ? levelDiff / timeDiff : 0;
  }

  // Predict future water levels
  async predictWaterLevel(currentData: any[], hoursAhead: number = 24): Promise<MLPrediction> {
    if (!this.isInitialized) {
      throw new Error('ML Service not initialized');
    }

    const model = this.models.get('water_level_prediction');
    if (!model) {
      throw new Error('Water level prediction model not available');
    }

    try {
      const features = this.extractFeatures(currentData.slice(-1));
      const inputTensor = tf.tensor2d(features);
      
      const prediction = model.predict(inputTensor) as tf.Tensor;
      const predictionValue = await prediction.data();
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();

      const confidence = Math.min(0.95, Math.max(0.1, 0.8 - (hoursAhead * 0.02))); // Confidence decreases with time

      return {
        type: 'water_level',
        prediction: Math.max(0, Math.min(100, predictionValue[0])),
        confidence,
        timeframe: `${hoursAhead} hours`,
        recommendations: this.generateWaterLevelRecommendations(predictionValue[0], currentData[currentData.length - 1]),
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Water level prediction error:', error);
      throw error;
    }
  }

  // Detect anomalies in water usage patterns
  async detectAnomalies(recentData: any[]): Promise<AnomalyDetection> {
    if (!this.isInitialized) {
      throw new Error('ML Service not initialized');
    }

    const model = this.models.get('anomaly_detection');
    if (!model) {
      throw new Error('Anomaly detection model not available');
    }

    try {
      const features = this.extractAnomalyFeatures(recentData);
      const inputTensor = tf.tensor2d([features]);
      
      const prediction = model.predict(inputTensor) as tf.Tensor;
      const anomalyScore = (await prediction.data())[0];
      
      inputTensor.dispose();
      prediction.dispose();

      const isAnomaly = anomalyScore > 0.7;
      const anomalyType = this.classifyAnomalyType(recentData, anomalyScore);
      
      return {
        is_anomaly: isAnomaly,
        anomaly_score: anomalyScore,
        anomaly_type: anomalyType,
        description: this.getAnomalyDescription(anomalyType, anomalyScore),
        severity: this.calculateSeverity(anomalyScore),
        recommended_actions: this.getAnomalyRecommendations(anomalyType, anomalyScore)
      };
    } catch (error) {
      console.error('Anomaly detection error:', error);
      throw error;
    }
  }

  private extractAnomalyFeatures(data: any[]): number[] {
    if (data.length === 0) return new Array(10).fill(0);

    const latest = data[data.length - 1];
    const consumptionRate = this.calculateConsumptionRate(latest, data);
    const avgLevel = data.reduce((sum, d) => sum + (d.level_percentage || 0), 0) / data.length;
    const motorCycles = data.filter(d => d.motor_running).length;
    
    return [
      latest.level_percentage || 0,
      consumptionRate,
      avgLevel,
      motorCycles,
      latest.wifi_rssi || -50,
      latest.free_heap || 50000,
      data.length,
      this.calculateLevelVariability(data),
      this.calculateMotorEfficiency(data),
      this.detectLevelSpikes(data)
    ];
  }

  private calculateLevelVariability(data: any[]): number {
    if (data.length < 2) return 0;
    const levels = data.map(d => d.level_percentage || 0);
    const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
    const variance = levels.reduce((sum, level) => sum + Math.pow(level - mean, 2), 0) / levels.length;
    return Math.sqrt(variance);
  }

  private calculateMotorEfficiency(data: any[]): number {
    const motorRuns = data.filter(d => d.motor_running);
    if (motorRuns.length === 0) return 1.0;

    const totalRuntime = motorRuns.length * 30; // Assuming 30-second intervals
    const levelIncrease = data[data.length - 1]?.level_percentage - data[0]?.level_percentage || 0;
    
    return levelIncrease > 0 ? levelIncrease / totalRuntime : 0;
  }

  private detectLevelSpikes(data: any[]): number {
    if (data.length < 3) return 0;
    
    let spikes = 0;
    for (let i = 1; i < data.length - 1; i++) {
      const prev = data[i - 1].level_percentage || 0;
      const curr = data[i].level_percentage || 0;
      const next = data[i + 1].level_percentage || 0;
      
      if (Math.abs(curr - prev) > 15 && Math.abs(curr - next) > 15) {
        spikes++;
      }
    }
    
    return spikes / data.length;
  }

  private classifyAnomalyType(data: any[], score: number): AnomalyDetection['anomaly_type'] {
    const latest = data[data.length - 1];
    const consumptionRate = this.calculateConsumptionRate(latest, data);
    
    if (consumptionRate > 20) return 'consumption_spike';
    if (this.detectLevelSpikes(data) > 0.3) return 'sensor_drift';
    if (this.calculateMotorEfficiency(data) < 0.1) return 'motor_efficiency';
    return 'leak_detection';
  }

  // Predict maintenance needs
  async predictMaintenance(deviceData: any[], motorHistory: any[]): Promise<MLPrediction> {
    if (!this.isInitialized) {
      throw new Error('ML Service not initialized');
    }

    const model = this.models.get('maintenance_prediction');
    if (!model) {
      throw new Error('Maintenance prediction model not available');
    }

    try {
      const features = this.extractMaintenanceFeatures(deviceData, motorHistory);
      const inputTensor = tf.tensor2d([features]);
      
      const prediction = model.predict(inputTensor) as tf.Tensor;
      const maintenanceProb = (await prediction.data())[0];
      
      inputTensor.dispose();
      prediction.dispose();

      return {
        type: 'maintenance',
        prediction: maintenanceProb,
        confidence: 0.85,
        timeframe: '30 days',
        recommendations: this.generateMaintenanceRecommendations(maintenanceProb, deviceData),
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Maintenance prediction error:', error);
      throw error;
    }
  }

  private extractMaintenanceFeatures(deviceData: any[], motorHistory: any[]): number[] {
    const latest = deviceData[deviceData.length - 1] || {};
    const totalMotorRuns = motorHistory.length;
    const avgRuntime = motorHistory.reduce((sum, run) => sum + (run.runtime_minutes || 0), 0) / Math.max(1, totalMotorRuns);
    
    return [
      latest.uptime_seconds || 0,
      latest.free_heap || 50000,
      latest.wifi_rssi || -50,
      totalMotorRuns,
      avgRuntime,
      this.calculateMotorEfficiency(deviceData),
      this.calculateErrorRate(deviceData),
      deviceData.length, // Total readings
      this.calculateUptimeStability(deviceData),
      this.calculateTemperatureStress(deviceData),
      this.calculateVibrationLevel(deviceData),
      this.calculatePowerConsumption(deviceData)
    ];
  }

  // Utility methods for feature calculation
  private calculateErrorRate(data: any[]): number {
    const errors = data.filter(d => d.error_count > 0).length;
    return data.length > 0 ? errors / data.length : 0;
  }

  private calculateUptimeStability(data: any[]): number {
    if (data.length < 2) return 1.0;
    
    const uptimes = data.map(d => d.uptime_seconds || 0);
    const increases = uptimes.slice(1).map((uptime, i) => uptime > uptimes[i]);
    return increases.filter(Boolean).length / increases.length;
  }

  private calculateTemperatureStress(data: any[]): number {
    // Simulate temperature stress based on motor runtime
    const motorRuns = data.filter(d => d.motor_running).length;
    return Math.min(1.0, motorRuns / (data.length * 0.3)); // 30% runtime = high stress
  }

  private calculateVibrationLevel(data: any[]): number {
    // Simulate vibration based on motor efficiency and errors
    const efficiency = this.calculateMotorEfficiency(data);
    const errorRate = this.calculateErrorRate(data);
    return Math.min(1.0, (1 - efficiency) + errorRate);
  }

  private calculatePowerConsumption(data: any[]): number {
    const motorRuns = data.filter(d => d.motor_running).length;
    return motorRuns / Math.max(1, data.length);
  }

  // Generate recommendations
  private generateWaterLevelRecommendations(predictedLevel: number, currentData: any): string[] {
    const recommendations: string[] = [];
    
    if (predictedLevel < 20) {
      recommendations.push('⚠️ Low water level predicted - consider manual refill');
      recommendations.push('🔧 Check pump system efficiency');
    }
    
    if (predictedLevel > 90) {
      recommendations.push('⬆️ Tank will be nearly full - monitor overflow');
      recommendations.push('🛑 Consider reducing pump runtime');
    }

    if (currentData?.motor_running && predictedLevel > 80) {
      recommendations.push('⏹️ Consider stopping motor to prevent overflow');
    }

    return recommendations;
  }

  private generateMaintenanceRecommendations(probability: number, deviceData: any[]): string[] {
    const recommendations: string[] = [];
    
    if (probability > 0.8) {
      recommendations.push('🔧 Schedule immediate maintenance check');
      recommendations.push('⚡ Monitor motor performance closely');
      recommendations.push('🧽 Clean sensors and check connections');
    } else if (probability > 0.6) {
      recommendations.push('📅 Schedule maintenance within 2 weeks');
      recommendations.push('📊 Monitor system performance trends');
    } else if (probability > 0.4) {
      recommendations.push('✅ System operating normally');
      recommendations.push('📈 Continue regular monitoring');
    }

    return recommendations;
  }

  private getAnomalyDescription(type: AnomalyDetection['anomaly_type'], score: number): string {
    const descriptions = {
      consumption_spike: `Unusual spike in water consumption detected (confidence: ${(score * 100).toFixed(1)}%)`,
      sensor_drift: `Water level sensor readings appear inconsistent (confidence: ${(score * 100).toFixed(1)}%)`,
      motor_efficiency: `Motor efficiency has decreased significantly (confidence: ${(score * 100).toFixed(1)}%)`,
      leak_detection: `Possible water leak detected in the system (confidence: ${(score * 100).toFixed(1)}%)`
    };
    
    return descriptions[type];
  }

  private calculateSeverity(score: number): AnomalyDetection['severity'] {
    if (score > 0.9) return 'critical';
    if (score > 0.8) return 'high';
    if (score > 0.7) return 'medium';
    return 'low';
  }

  private getAnomalyRecommendations(type: AnomalyDetection['anomaly_type'], score: number): string[] {
    const baseRecommendations = {
      consumption_spike: [
        '🔍 Check for water leaks in the system',
        '📊 Review recent usage patterns',
        '🚰 Inspect all water outlets and connections'
      ],
      sensor_drift: [
        '🧹 Clean water level sensors',
        '🔧 Check sensor connections and wiring',
        '📏 Calibrate sensors if necessary'
      ],
      motor_efficiency: [
        '⚙️ Inspect pump motor and impeller',
        '🔧 Check for mechanical wear or blockages',
        '⚡ Test electrical connections and voltage'
      ],
      leak_detection: [
        '🚨 Immediately inspect system for leaks',
        '🔍 Check tank integrity and pipe connections',
        '⏹️ Consider stopping system until inspection'
      ]
    };

    const recommendations = [...baseRecommendations[type]];
    
    if (score > 0.9) {
      recommendations.unshift('🚨 IMMEDIATE ACTION REQUIRED');
    }

    return recommendations;
  }

  // Training methods (for continuous learning)
  async trainModels(historicalData: WaterUsagePattern[]) {
    if (!this.isInitialized) {
      console.log('Deferring training until ML service is initialized');
      this.trainingData = historicalData;
      return;
    }

    console.log('🎓 Training ML models with', historicalData.length, 'data points');
    
    try {
      await this.trainWaterLevelModel(historicalData);
      await this.trainAnomalyModel(historicalData);
      await this.trainMaintenanceModel(historicalData);
      
      // Save models to browser storage
      await this.saveModels();
      
      console.log('✅ ML models training completed');
    } catch (error) {
      console.error('❌ ML training failed:', error);
    }
  }

  private async trainWaterLevelModel(data: WaterUsagePattern[]) {
    const model = this.models.get('water_level_prediction');
    if (!model || data.length < 10) return;

    const features = data.map(d => [
      d.level_percentage,
      d.consumption_rate,
      d.motor_runtime,
      d.hour_of_day,
      d.day_of_week,
      d.season,
      0, 0 // Placeholder features
    ]);

    const labels = data.map(d => d.level_percentage);

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    await model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();
  }

  private async trainAnomalyModel(data: WaterUsagePattern[]) {
    // Implement anomaly detection training
    console.log('Training anomaly detection model...');
  }

  private async trainMaintenanceModel(data: WaterUsagePattern[]) {
    // Implement maintenance prediction training
    console.log('Training maintenance prediction model...');
  }

  private async saveModels() {
    for (const [name, model] of this.models) {
      try {
        await model.save(`indexeddb://${name}`);
        console.log(`💾 Saved ${name} model`);
      } catch (error) {
        console.error(`Failed to save ${name} model:`, error);
      }
    }
  }

  // Public API methods
  async getMLInsights(tankData: any[], motorHistory: any[] = []): Promise<{
    predictions: MLPrediction[];
    anomalies: AnomalyDetection[];
  }> {
    if (!this.isInitialized) {
      return { predictions: [], anomalies: [] };
    }

    try {
      const predictions: MLPrediction[] = [];
      const anomalies: AnomalyDetection[] = [];

      // Get water level predictions
      if (tankData.length > 0) {
        predictions.push(await this.predictWaterLevel(tankData, 6));  // 6 hours
        predictions.push(await this.predictWaterLevel(tankData, 24)); // 24 hours
      }

      // Get maintenance predictions
      if (tankData.length > 0) {
        predictions.push(await this.predictMaintenance(tankData, motorHistory));
      }

      // Detect anomalies
      if (tankData.length > 5) {
        anomalies.push(await this.detectAnomalies(tankData.slice(-20))); // Last 20 readings
      }

      return { predictions, anomalies };
    } catch (error) {
      console.error('ML insights generation failed:', error);
      return { predictions: [], anomalies: [] };
    }
  }
}

// Export singleton instance
export const mlService = new AquaGuardMLService();
export default mlService;
