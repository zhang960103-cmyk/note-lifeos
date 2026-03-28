import { useNavigate, useLocation } from "react-router-dom";

const tabs = [
  { path: "/", icon: "🧭", label: "今天" },
  { path: "/todos", icon: "✅", label: "待办" },
  { path: "/wealth", icon: "💰", label: "财富" },
  { path: "/history", icon: "🕐", label: "历史" },
  { path: "/guide", icon: "📖", label: "指南" },
];

export default function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 inset-x-0 bg-surface-1 border-t border-border z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex max-w-[600px] mx-auto h-[52px]">
        {tabs.map(tab => {
          const active = tab.path === "/" ? location.pathname === "/" : location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition ${active ? "text-gold" : "text-muted-foreground"}`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="text-[9px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
