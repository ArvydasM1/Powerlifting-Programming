/** Shows render errors on screen instead of a blank page (no logcat on the phone). */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
  info: string | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack ?? null });
    console.error("Render error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const text = `${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack ?? ""}\n${this.state.info ?? ""}`;
    return (
      <div className="screen">
        <h1>Something went wrong</h1>
        <p className="small">Copy this and send it to the developer.</p>
        <textarea readOnly rows={12} value={text} style={{ fontFamily: "monospace", fontSize: 11 }} onFocus={(e) => e.target.select()} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn-primary" onClick={() => { window.location.hash = "#/"; this.setState({ error: null, info: null }); }}>
            Back to Today
          </button>
          <button className="btn" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
