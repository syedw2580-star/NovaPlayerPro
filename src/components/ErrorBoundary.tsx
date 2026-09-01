import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 m-4 bg-red-950/40 border border-red-500/30 rounded-xl text-white text-center space-y-4 max-w-md mx-auto shadow-2xl backdrop-blur-md">
          <div className="p-3 bg-red-500/20 rounded-full text-red-400 animate-pulse">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">
              {this.props.fallbackTitle || 'Component Processing Exception'}
            </h3>
            <p className="text-xs text-white/60">
              An unexpected error occurred while parsing media or rendering components.
            </p>
            {this.state.error && (
              <p className="text-[10px] font-mono bg-black/50 p-2 rounded text-red-300 border border-red-500/20 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-lg"
          >
            <RefreshCw size={13} />
            Recover System State
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
