import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    logger.error('ErrorBoundary', 'Uncaught React render error caught', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReset = (): void => {
    logger.info('ErrorBoundary', 'User triggered workspace reset');
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
  };

  private handleCopyDetails = (): void => {
    const { error, errorInfo } = this.state;
    const details = `AutoCaption Crash Report
Timestamp: ${new Date().toISOString()}
Error: ${error?.message || 'Unknown error'}
Stack:
${error?.stack || 'No stack trace'}
Component Stack:
${errorInfo?.componentStack || 'No component stack'}`;

    void navigator.clipboard.writeText(details);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0b0d11] p-8 text-neutral-200">
          <div className="w-full max-w-xl rounded-xl border border-red-500/30 bg-[#14171f] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h2 className="text-lg font-semibold tracking-wide">Workspace Render Exception</h2>
            </div>

            <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
              AutoCaption Studio encountered an unhandled interface exception. Your project state has been preserved locally.
            </p>

            <div className="mt-4 max-h-48 overflow-auto rounded bg-[#0b0d11] p-3 font-mono text-xs text-red-300 border border-[#222836]">
              <div className="font-bold text-red-400">{this.state.error?.toString()}</div>
              {this.state.errorInfo?.componentStack && (
                <pre className="mt-2 text-[11px] text-neutral-500 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={this.handleCopyDetails}
                className="inline-flex items-center gap-2 rounded border border-[#262d3d] bg-[#1a202c] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-[#222a3a] transition-colors"
              >
                {this.state.copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied Report</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Diagnostics</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reload Workspace</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
