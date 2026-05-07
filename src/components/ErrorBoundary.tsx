import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-background text-center">
          <span className="text-4xl">💥</span>
          <p className="text-muted-foreground text-sm">出了点小问题，请尝试重新加载</p>
          <p className="text-muted-foreground/50 text-[10px] max-w-xs break-all">{this.state.error?.message}</p>
          <button
            className="px-4 py-2 rounded-xl bg-gold text-background text-sm hover:bg-gold/90 transition"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
