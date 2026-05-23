import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[auth-switch] Renderer crash:", error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: "24px",
            fontFamily: "monospace",
            background: "#080b0f",
            color: "#ff7b72",
            height: "100vh",
            boxSizing: "border-box"
          }}
        >
          <p style={{ color: "#7ee787", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            auth-switch — render error
          </p>
          <h2 style={{ marginTop: 8 }}>{this.state.error.message}</h2>
          <pre style={{ fontSize: 12, color: "#8b98a8", marginTop: 12, whiteSpace: "pre-wrap" }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
