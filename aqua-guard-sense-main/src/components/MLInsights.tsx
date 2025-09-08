// AquaGuard ML Insights Component
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Zap, 
  Activity,
  Settings,
  RefreshCw,
  Target,
  Shield
} from "lucide-react";
import { mlService, type MLPrediction, type AnomalyDetection } from "@/services/ml/mlService";

interface MLInsightsProps {
  tankData: any[];
  motorHistory: any[];
  onInsightAction?: (actionType: string, data: any) => void;
}

export function MLInsights({ tankData, motorHistory, onInsightAction }: MLInsightsProps) {
  const [predictions, setPredictions] = useState<MLPrediction[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mlStatus, setMlStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');

  useEffect(() => {
    initializeMLService();
  }, []);

  useEffect(() => {
    if (mlStatus === 'ready' && tankData.length > 0) {
      generateInsights();
    }
  }, [tankData, motorHistory, mlStatus]);

  const initializeMLService = async () => {
    try {
      setMlStatus('initializing');
      await mlService.initializeML();
      setMlStatus('ready');
    } catch (error) {
      console.error('ML Service initialization failed:', error);
      setMlStatus('error');
    }
  };

  const generateInsights = async () => {
    if (tankData.length === 0) return;
    
    setIsLoading(true);
    try {
      const insights = await mlService.getMLInsights(tankData, motorHistory);
      setPredictions(insights.predictions);
      setAnomalies(insights.anomalies);
    } catch (error) {
      console.error('Failed to generate ML insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    generateInsights();
  };

  const handleActionClick = (actionType: string, data: any) => {
    if (onInsightAction) {
      onInsightAction(actionType, data);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPredictionIcon = (type: string) => {
    switch (type) {
      case 'water_level': return <TrendingUp className="w-4 h-4" />;
      case 'maintenance': return <Settings className="w-4 h-4" />;
      case 'efficiency': return <Zap className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getAnomalyIcon = (type: string) => {
    switch (type) {
      case 'consumption_spike': return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'sensor_drift': return <Activity className="w-4 h-4 text-orange-500" />;
      case 'motor_efficiency': return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'leak_detection': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  if (mlStatus === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            ML Insights
          </CardTitle>
          <CardDescription>Artificial Intelligence powered water management insights</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>ML Service Unavailable</AlertTitle>
            <AlertDescription>
              Machine Learning features are currently unavailable. The system will continue to operate normally.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                ML Insights
                {mlStatus === 'initializing' && (
                  <Badge variant="outline" className="ml-2">
                    <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                    Initializing
                  </Badge>
                )}
                {mlStatus === 'ready' && (
                  <Badge variant="outline" className="ml-2 text-green-600">
                    <Target className="w-3 h-3 mr-1" />
                    Ready
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                AI-powered predictions and anomaly detection for your water management system
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoading || mlStatus !== 'ready'}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Predictions */}
      {predictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🔮 Predictive Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {predictions.map((prediction, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getPredictionIcon(prediction.type)}
                    <h4 className="font-semibold capitalize">
                      {prediction.type.replace('_', ' ')} Prediction
                    </h4>
                  </div>
                  <Badge variant="secondary">
                    {(prediction.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {prediction.type === 'water_level' && 'Predicted Level:'}
                      {prediction.type === 'maintenance' && 'Maintenance Probability:'}
                      {prediction.type === 'efficiency' && 'Efficiency Score:'}
                    </span>
                    <span className="font-mono font-semibold">
                      {prediction.type === 'water_level' && `${prediction.prediction.toFixed(1)}%`}
                      {prediction.type === 'maintenance' && `${(prediction.prediction * 100).toFixed(1)}%`}
                      {prediction.type === 'efficiency' && `${(prediction.prediction * 100).toFixed(1)}%`}
                    </span>
                  </div>
                  
                  <Progress 
                    value={prediction.type === 'water_level' ? prediction.prediction : prediction.prediction * 100} 
                    className="h-2"
                  />
                  
                  <p className="text-sm text-muted-foreground">
                    Timeframe: {prediction.timeframe}
                  </p>
                </div>

                {prediction.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Recommendations:</h5>
                    <ul className="space-y-1">
                      {prediction.recommendations.map((rec, recIndex) => (
                        <li key={recIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-xs mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Anomaly Detection */}
      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🛡️ Anomaly Detection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {anomalies.map((anomaly, index) => (
              <Alert key={index} className={getSeverityColor(anomaly.severity)}>
                <div className="flex items-start gap-3">
                  {getAnomalyIcon(anomaly.anomaly_type)}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <AlertTitle className="capitalize">
                        {anomaly.anomaly_type.replace('_', ' ')} Detected
                      </AlertTitle>
                      <Badge variant={anomaly.is_anomaly ? "destructive" : "secondary"}>
                        {anomaly.severity.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <AlertDescription>
                      {anomaly.description}
                    </AlertDescription>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>Anomaly Score:</span>
                        <span className="font-mono">{(anomaly.anomaly_score * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={anomaly.anomaly_score * 100} className="h-2" />
                    </div>

                    {anomaly.recommended_actions.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <h5 className="font-medium text-sm">Recommended Actions:</h5>
                        <ul className="space-y-1">
                          {anomaly.recommended_actions.map((action, actionIndex) => (
                            <li key={actionIndex} className="text-sm flex items-start gap-2">
                              <span className="text-xs mt-1">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                        
                        {anomaly.severity === 'critical' && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleActionClick('emergency_action', anomaly)}
                            className="mt-2"
                          >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Take Emergency Action
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ML Status Information */}
      {mlStatus === 'ready' && tankData.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <Brain className="w-12 h-12 text-muted-foreground mx-auto" />
              <h3 className="font-semibold">Waiting for Data</h3>
              <p className="text-sm text-muted-foreground">
                ML insights will appear once water level data is available.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && mlStatus === 'ready' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto animate-spin" />
              <h3 className="font-semibold">Analyzing Data...</h3>
              <p className="text-sm text-muted-foreground">
                AI models are processing your water management data.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
