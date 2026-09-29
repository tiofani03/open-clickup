"use client";

import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
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

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center p-6 text-center text-sm text-cu-text-secondary">
          <p className="font-semibold text-cu-text">Something went wrong</p>
          <p className="mt-1 max-w-md text-xs text-cu-text-tertiary">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 rounded bg-cu-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-cu-purple-dark"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
