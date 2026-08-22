import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";

// 全局兜底：ErrorBoundary(src/components/ErrorBoundary.tsx)只能捕获React
// "渲染阶段"抛出的同步错误。事件处理函数里漏写的try/catch、没接signal的
// fetch、任何异步Promise被拒绝且没人catch——这些都绕得过ErrorBoundary，
// 之前完全没有兜底，轻则控制台一条看不见的报错，重则某个交互从此没反应。
// 这里加一层最后防线：不让App整个崩掉，只是记录+轻提示，不打断其他功能。
window.addEventListener("unhandledrejection", (event) => {
  const reason: any = event.reason;
  // AbortController取消请求(比如切页面时中止AI回复流、复盘重新生成时取消上一次)
  // 是本App里刻意设计的正常行为，不是错误，不需要打扰用户。
  if (reason?.name === "AbortError" || reason?.code === "STREAM_ABORTED") return;
  console.error("[全局兜底] 未处理的异步异常:", reason);
  toast.error("刚才有个操作没能完成，请重试", { id: "global-unhandled-rejection" });
});

window.addEventListener("error", (event) => {
  console.error("[全局兜底] 未捕获的运行时异常:", event.error || event.message);
});

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker (production only, not in iframe/preview)
if ("serviceWorker" in navigator) {
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const isPreviewHost =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com");

  if (isPreviewHost || isInIframe) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        // Check for updates every 30 minutes
        setInterval(() => reg.update(), 30 * 60 * 1000);
        // When a new SW is found, activate it immediately
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated") {
                window.location.reload();
              }
            });
          }
        });
      }).catch(() => {});
    });
  }
}
