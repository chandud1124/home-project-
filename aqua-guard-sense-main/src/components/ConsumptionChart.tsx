
import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { TrendingUp, Activity } from "lucide-react";

interface ConsumptionData {
  date: string;
  consumption: number;
  fills: number;
  motorStarts: number;
}

interface ConsumptionChartProps {
  dailyData: ConsumptionData[];
  monthlyData: ConsumptionData[];
}

export const ConsumptionChart = ({ dailyData, monthlyData }: ConsumptionChartProps) => {
  const [chartData, setChartData] = useState<ConsumptionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set the daily data as default
    if (dailyData && dailyData.length > 0) {
      setChartData(dailyData);
    }
  }, [dailyData]);

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      color: string;
      name: string;
      value: number;
      dataKey: string;
    }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium text-card-foreground">{label}</p>
          {payload.map((entry, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value}{entry.dataKey === 'consumption' ? 'L' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return dateString;
  };

  if (loading) {
    return (
      <Card className="p-6 bg-card border-border">
        <p className="text-center text-muted-foreground">Loading consumption data...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-card border-border">
        <p className="text-center text-destructive">Error: {error}</p>
      </Card>
    );
  }

  // Check if data exists and show appropriate messages
  const hasDailyData = dailyData && dailyData.length > 0;
  const hasMonthlyData = monthlyData && monthlyData.length > 0;

  if (!hasDailyData && !hasMonthlyData) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="text-center py-8">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">No Data Available</h3>
          <p className="text-sm text-muted-foreground">
            Consumption data will appear here once the backend starts sending data.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border-border shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-semibold text-card-foreground">Water Consumption Analytics</h3>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Daily View
          </TabsTrigger>
          <TabsTrigger value="monthly">Monthly View</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          {!hasDailyData ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-medium text-muted-foreground mb-2">No Daily Data</h4>
              <p className="text-sm text-muted-foreground">
                Daily consumption data is not available from the backend.
              </p>
            </div>
          ) : (
            <>
              {/* Daily Consumption Line Chart */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Daily Water Consumption</h4>
                <div className="h-64 border border-red-500">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#666"
                        fontSize={12}
                        tickFormatter={formatDate}
                      />
                      <YAxis 
                        stroke="#666"
                        fontSize={12}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="consumption" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                        name="Consumption (L)"
                        activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Daily Motor Activity Bar Chart */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Motor Activity</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={formatDate}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar 
                        dataKey="motorStarts" 
                        fill="hsl(var(--success))" 
                        name="Motor Starts"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="fills" 
                        fill="hsl(var(--primary))" 
                        name="Tank Fills"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          {!hasMonthlyData ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-medium text-muted-foreground mb-2">No Monthly Data</h4>
              <p className="text-sm text-muted-foreground">
                Monthly consumption data is not available from the backend.
              </p>
            </div>
          ) : (
            <>
              {/* Monthly Overview */}
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Monthly Consumption Trends</h4>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={formatDate}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar 
                        dataKey="consumption" 
                        fill="hsl(var(--accent))" 
                        name="Total Consumption (L)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="motorStarts" 
                        fill="hsl(var(--warning))" 
                        name="Total Motor Starts"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};
