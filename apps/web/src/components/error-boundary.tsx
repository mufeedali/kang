import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  // Optional custom fallback; defaults to a minimal inline message.
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

// React still requires class components for error boundaries (no hook equivalent).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center p-8 gap-3 text-center">
            <p className="text-sm font-medium text-destructive">
              Something went wrong.
            </p>
            <p className="text-xs text-muted-foreground">
              {this.state.error.message}
            </p>
            <button
              type="button"
              className="text-xs underline text-muted-foreground hover:text-foreground"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
