import { Component, type ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

// 这个组件之前只在 App.tsx 最外层包了一次——意味着任何一个页面内部的渲染错误，
// 都会把最外层这一整棵组件树全部卸载掉(React的默认行为)，包括Toaster、底部
// TabBar、桌面端侧边栏，用户看到的是一片全屏黑屏，其他本来完全正常的模块也
// 跟着一起"死机"，完全违背"单个模块故障不搞垮整个APP"的要求。
//
// 现在支持传入 `scope="page"` 在路由内容区域再包一层——这样某个页面自己崩了，
// 只有那个页面的内容区域会显示这个兜底UI，顶部导航/底部Tab/其他还没崩的页面
// 完全不受影响，切换到别的Tab就能恢复正常使用。外层App.tsx那层作为最后一道
// 保险继续保留(比如Provider本身抛错这种更早期的崩溃，还是需要它兜底)。
interface Props {
  children: ReactNode;
  scope?: "app" | "page";
  boundaryName?: string;
}
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error(`[ErrorBoundary${this.props.boundaryName ? `:${this.props.boundaryName}` : ""}] 捕获到渲染错误:`, error, info?.componentStack);
  }

  handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      const isPageScope = this.props.scope === "page";
      return (
        <ErrorFallback
          isPageScope={isPageScope}
          onRetry={this.handleRetry}
          onHome={() => { window.location.href = "/"; }}
        />
      );
    }
    return this.props.children;
  }
}

// Class components can't call hooks directly, so the fallback UI (which needs
// useLanguage() for the retry/home copy) is split out into its own function
// component and rendered from ErrorBoundary.render() above — this is still
// mounted inside LanguageProvider's tree (see App.tsx), so the hook works fine.
function ErrorFallback({ isPageScope, onRetry, onHome }: { isPageScope: boolean; onRetry: () => void; onHome: () => void }) {
  const { t } = useLanguage();
  return (
    <div className={`${isPageScope ? "h-full" : "fixed inset-0"} flex flex-col items-center justify-center gap-4 p-6 bg-background text-center`}>
      <span className="text-4xl">😵</span>
      <p className="text-foreground text-sm font-serif-sc">{t("error_boundary.title")}</p>
      <p className="text-muted-foreground text-caption max-w-xs leading-relaxed">
        {t("error_boundary.desc")}
      </p>
      <div className="flex gap-2">
        <button
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition"
          onClick={onRetry}
        >
          {t("error_boundary.retry")}
        </button>
        <button
          className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm hover:bg-accent transition"
          onClick={onHome}
        >
          {t("error_boundary.home")}
        </button>
      </div>
    </div>
  );
}
