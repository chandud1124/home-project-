
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="p-6 m-4 bg-destructive/5 border-destructive/20">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          </div>
          
          <p className="text-muted-foreground mb-4">
            An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
          </p>

          <div className="flex gap-3">
            <Button onClick={this.handleRetry} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 p-3 bg-muted rounded border">
              <summary className="cursor-pointer font-medium">Error Details</summary>
              <pre className="mt-2 text-xs overflow-auto">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </Card>
      );
    }

    return this.props.children;
  }
}
