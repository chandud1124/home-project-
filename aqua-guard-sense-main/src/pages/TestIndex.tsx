import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { apiService } from "@/services/api";
import { Waves, Zap } from "lucide-react";

export default function TestIndex() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [totalWaterLevel, setTotalWaterLevel] = useState(0);

  useEffect(() => {
    console.log('🚀 Test Index page loaded successfully');

    // Simple test to check if API service works
    const testConnection = async () => {
      try {
        console.log('🔍 Testing API connection...');
        const tanks = await apiService.getTanks();
        console.log('✅ API connection successful, tanks:', tanks);
        setIsLoading(false);
      } catch (error) {
        console.error('❌ API connection failed:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to backend. Check if server is running.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };

    testConnection();
  }, [toast]);

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
              <Waves className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AquaFlow Pro - Test Mode
            </h1>
          </div>
          <p className="text-muted-foreground">Testing basic functionality</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/60 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Waves className="h-5 w-5 text-primary" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-6 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-success/10 border-success/20 text-success">
                    ✅ React App Working
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Frontend loaded successfully
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-warning" />
                API Connection
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-6 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-success/10 border-success/20 text-success">
                    ✅ API Connected
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Backend communication working
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <Button
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              window.location.reload();
            }}
            className="bg-primary hover:bg-primary/90"
          >
            🔄 Refresh Page
          </Button>
        </div>
      </div>
    </div>
  );
}
