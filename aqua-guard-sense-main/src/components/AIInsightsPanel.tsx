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
        <h3 className="text-lg font-semibold">AI Insights</h3>
      </div>

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
          <p className="text-sm text-muted-foreground text-center py-4">
            No insights available. More data needed for AI analysis.
          </p>
        ) : (
          insights.map((insight) => (
            <div key={insight.id} className="p-3 border rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getInsightIcon(insight.type)}
                  <span className="font-medium text-sm">{insight.title}</span>
                </div>
                <Badge variant={getPriorityColor(insight.priority)} className="text-xs">
                  {insight.priority}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{insight.message}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Confidence: {Math.round(insight.confidence * 100)}%</span>
                <span>{insight.timestamp.toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
