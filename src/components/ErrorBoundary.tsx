// Globálny ErrorBoundary (Issue #2 — S1.1.2)
// Zachytí chyby renderu a zobrazí fallback UI namiesto bielej obrazovky.
// Chyby sa automaticky posielajú do Sentry.

import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, eventId: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Pošli do Sentry
    const eventId = Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
    this.setState({ eventId });

    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, eventId: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell bg-bg flex items-center justify-center p-6">
          <div className="card p-6 max-w-sm w-full text-center">
            {/* Ikona */}
            <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            <h1 className="text-lg font-bold text-slate-100 mb-2">
              Niečo sa pokazilo
            </h1>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              Nastala neočakávaná chyba. Tím bol automaticky informovaný.
            </p>

            {/* Detail chyby (len v dev) */}
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-[11px] text-slate-500 bg-bg-surface p-3 rounded-xl mb-4 overflow-auto max-h-32 text-left">
                {this.state.error.message}
              </pre>
            )}

            {/* Tlačidlá */}
            <button onClick={this.handleReload} className="btn-primary mb-2">
              Obnoviť aplikáciu
            </button>
            <button onClick={this.handleReset} className="btn-secondary text-sm">
              Skúsiť znova
            </button>

            {/* Event ID pre debug */}
            {this.state.eventId && (
              <p className="text-[10px] text-slate-600 mt-4">
                ID: {this.state.eventId}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
