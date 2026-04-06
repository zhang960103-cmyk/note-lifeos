import { useState, useEffect } from "react";
import { X } from "lucide-react";

const InstallBanner = () => {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem("lifeos_install_dismissed");
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    }
    setShow(false);
  };

  const dismiss = () => {
    localStorage.setItem("lifeos_install_dismissed", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
      <div className="max-w-[500px] mx-auto bg-surface-2 border border-gold-border rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-sm">🧭</span>
        <button onClick={install} className="flex-1 text-left text-xs text-foreground">
          添加到主屏幕，随时打开
        </button>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default InstallBanner;
