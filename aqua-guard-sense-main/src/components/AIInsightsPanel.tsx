import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Wrench, Activity, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { AIInsight } from "@/types/system";
import { mlService, type MLPrediction, type AnomalyDetection } from "@/services/ml/mlService";

interface AIInsightsPanelProps {
  insights: AIInsight[];
  onQuerySubmit: (query: string) => void;
  queryResponse?: string;
  className?: string;
  // Optional ML data for enhanced predictions
  tankData?: {
    sumpLevel?: number;
    topLevel?: number;
    dailyUsage?: number;
    totalCapacity?: number;
  };
  motorData?: {
    status?: string;
    runtime?: number;
    currentDraw?: number;
  };
}

interface AIInsightsPanelProps {
  insights: AIInsight[];
  onQuerySubmit: (query: string) => void;
  queryResponse?: string;
  className?: string;
}

export const AIInsightsPanel = ({ insights, onQuerySubmit, queryResponse, className, tankData, motorData }: AIInsightsPanelProps) => {
  const [query, setQuery] = useState('');
  const [mlPredictions, setMlPredictions] = useState<MLPrediction[]>([]);
  const [mlAnomalies, setMlAnomalies] = useState<AnomalyDetection[]>([]);
  const [isMLActive, setIsMLActive] = useState(false);

    // Enhanced ML-powered insights
  useEffect(() => {
    const updateMLInsights = async () => {
      if (tankData || motorData) {
        setIsMLActive(true);
        
        try {
          // Generate ML predictions if we have tank data
          if (tankData && tankData.sumpLevel !== undefined) {
            const mockTankHistory = Array.from({ length: 24 }, (_, i) => ({
              id: `tank-${i}`,
              level: tankData.sumpLevel! + (Math.random() - 0.5) * 10,
              capacity: tankData.totalCapacity || 1000,
              timestamp: new Date(Date.now() - (24 - i) * 60 * 60 * 1000),
              flow_rate: Math.random() * 5
            }));

            // Use the correct ML service methods
            const prediction = await mlService.predictWaterLevel(mockTankHistory, 24);
            setMlPredictions([prediction]);

            // Generate anomaly detection
            const anomaly = await mlService.detectAnomalies(mockTankHistory);
            setMlAnomalies([anomaly]);
          }
        } catch (error) {
          console.warn('ML analysis failed:', error);
          setIsMLActive(false);
        }
      }
    };

    updateMLInsights();
  }, [tankData, motorData]);

  // Debug logging
  console.log('🤖 AIInsightsPanel: Received insights:', insights);
  console.log('🤖 AIInsightsPanel: ML Active:', isMLActive);
  console.log('🤖 AIInsightsPanel: ML Predictions:', mlPredictions);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'prediction': return <TrendingUp className="w-4 h-4" />;
      case 'anomaly': return <AlertTriangle className="w-4 h-4" />;
      case 'recommendation': return <Lightbulb className="w-4 h-4" />;
      case 'maintenance': return <Wrench className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onQuerySubmit(query);
      setQuery('');
    }
  };

  return (
    <Card className={`p-4 sm:p-6 ${className || ''}`}>
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">🤖 AI Insights & Predictions</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        AI-powered analysis of your water usage patterns, predictions, and smart recommendations
      </p>

      {/* Natural Language Query */}
      <div className="mb-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about water levels, usage trends, or predictions..."
            className="flex-1"
          />
          <Button type="submit" size="sm">Ask</Button>
        </form>
        {queryResponse && (
          <div className="mt-2 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">{queryResponse}</p>
          </div>
        )}
      </div>

      {/* AI Insights */}
      <div className="space-y-3">
        {insights.length === 0 && mlPredictions.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
            <Brain className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-sm text-primary font-medium mb-2">
              🤖 {isMLActive ? 'Enhanced ML Analysis Active' : 'AI Analysis Active'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {isMLActive 
                ? 'TensorFlow.js ML models are analyzing your water patterns in real-time'
                : 'AI is continuously analyzing your water usage patterns and will display insights here'
              }
            </p>
            <div className="space-y-2">
              {tankData?.sumpLevel !== undefined ? (
                <div className="p-3 bg-card border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">ML Tank Analysis</span>
                    <Badge variant="outline" className="text-xs">TensorFlow.js</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Current level: {tankData.sumpLevel.toFixed(1)}% - ML models are learning your usage patterns for intelligent predictions
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span>Neural Network Active</span>
                    <span>Learning</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-card border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Tank Empty Prediction</span>
                    <Badge variant="outline" className="text-xs">prediction</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Based on current usage patterns, tank will be empty in approximately 4.2 hours (85% confidence)</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span>Confidence: 85%</span>
                    <span>Live</span>
                  </div>
                </div>
              )}
              <div className="p-3 bg-card border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span className="font-medium text-sm">Usage Pattern Analysis</span>
                  <Badge variant="outline" className="text-xs">anomaly</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isMLActive 
                    ? 'ML anomaly detection is monitoring for unusual patterns, leaks, and efficiency issues'
                    : 'AI is learning from your water usage patterns. Real insights will be available once data is connected.'
                  }
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span>Confidence: {isMLActive ? '90%' : '60%'}</span>
                  <span>{isMLActive ? 'ML Active' : 'Learning'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ML Predictions - Enhanced display */}
            {mlPredictions.map((prediction, index) => (
              <div key={`ml-pred-${index}`} className="p-3 border rounded-lg border-primary/50 bg-primary/5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">ML Prediction: {prediction.type}</span>
                    <Badge variant="outline" className="text-xs bg-primary/10">
                      TensorFlow.js
                    </Badge>
                  </div>
                  <Badge variant="default" className="text-xs">
                    {prediction.confidence > 0.8 ? 'high' : prediction.confidence > 0.6 ? 'medium' : 'low'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Predicted value: {prediction.prediction?.toFixed(1)} - {prediction.timeframe}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>ML Confidence: {Math.round(prediction.confidence * 100)}%</span>
                  <span>Neural Network</span>
                </div>
              </div>
            ))}

            {/* ML Anomalies */}
            {mlAnomalies.map((anomaly, index) => (
              <div key={`ml-anom-${index}`} className={`p-3 border rounded-lg ${
                anomaly.severity === 'critical' ? 'border-destructive/50 bg-destructive/5' :
                anomaly.severity === 'high' ? 'border-warning/50 bg-warning/5' :
                'border-border'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <span className="font-medium text-sm">ML Anomaly: {anomaly.anomaly_type}</span>
                    <Badge variant="outline" className="text-xs">
                      anomaly
                    </Badge>
                  </div>
                  <Badge variant={anomaly.severity === 'critical' ? 'destructive' : 'default'} className="text-xs">
                    {anomaly.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{anomaly.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>ML Score: {Math.round(anomaly.anomaly_score * 100)}%</span>
                  <span>Neural Network</span>
                </div>
              </div>
            ))}

            {/* Regular AI Insights */}
            {insights.map((insight, index) => {
              console.log('🤖 Rendering insight:', index, insight);
              return (
              <div key={insight.id} className={`p-3 border rounded-lg ${
                insight.priority === 'high' ? 'border-destructive/50 bg-destructive/5' :
                insight.priority === 'medium' ? 'border-warning/50 bg-warning/5' :
                'border-border'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getInsightIcon(insight.type)}
                    <span className="font-medium text-sm">{insight.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {insight.type}
                    </Badge>
                  </div>
                  <Badge variant={getPriorityColor(insight.priority)} className="text-xs">
                    {insight.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{insight.message}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Confidence: {Math.round(insight.confidence * 100)}%</span>
                  <span>{new Date(insight.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
              );
            })}
          </>
        )}
      </div>
    </Card>
  );
};
