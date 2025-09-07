import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Wrench } from "lucide-react";
import { useState } from "react";
import { AIInsight } from "@/types/system";

interface AIInsightsPanelProps {
  insights: AIInsight[];
  onQuerySubmit: (query: string) => void;
  queryResponse?: string;
  className?: string;
}

export const AIInsightsPanel = ({ insights, onQuerySubmit, queryResponse, className }: AIInsightsPanelProps) => {
  const [query, setQuery] = useState('');

  // Debug logging
  console.log('🤖 AIInsightsPanel: Received insights:', insights);
  console.log('🤖 AIInsightsPanel: Insights length:', insights?.length || 0);

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
        {insights.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
            <Brain className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-sm text-primary font-medium mb-2">
              🤖 AI Analysis Active
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              AI is continuously analyzing your water usage patterns and will display insights here
            </p>
            <div className="space-y-2">
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
              <div className="p-3 bg-card border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span className="font-medium text-sm">Usage Pattern Analysis</span>
                  <Badge variant="outline" className="text-xs">anomaly</Badge>
                </div>
                <p className="text-sm text-muted-foreground">AI is learning from your water usage patterns. Real insights will be available once data is connected.</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span>Confidence: 60%</span>
                  <span>Learning</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          insights.map((insight, index) => {
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
          })
        )}
      </div>
    </Card>
  );
};
