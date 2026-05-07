import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MoreHorizontal, X, BookOpen, Target, Clock, History, Star, CalendarDays, BarChart2 } from "lucide-react";

// 主Tab：今日/待办/日历/复盘/财富
// 日历 = 时间入口（直觉），时间统计进入分析页
const MAIN_TABS = [
  { path: "/",          icon: "🧭", label: "今日" },
  { path: "/todos",     icon: "✅", label: "待办" },
  { path: "/calendar",  icon: "📅", label: "日历" },
  { path: "/review",    icon: "✍️", label: "复盘" },
  { path: "/wealth",    icon: "💰", label: "财富" },
];

// 更多抽屉：三组
const MORE_GROUPS = [
  {
    label: "成长分析",
    items: [
      { path: "/time-stats", icon: <BarChart2 size={16} />, label: "时间分析" },
      { path: "/wheel",      icon: <Target size={16} />,    label: "生命之轮" },
      { path: "/goals",      icon: <Star size={16} />,      label: "目标 OKR" },
    ],
  },
  {
    label: "记录",
    items: [
      { path: "/history",  icon: <History size={16} />,     label: "日记墙" },
    ],
  },
  {
    label: "帮助",
    items: [
      { path: "/guide",    icon: <BookOpen size={16} />,    label: "使用指南" },
    ],
  },
];

export default function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMore(false)}>
          <div
            className="absolute bottom-[52px] left-0 right-0 max-w-[600px] mx-auto bg-surface-1 border-t border-border px-4 py-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-serif-sc text-foreground">更多功能</span>
              <button onClick={() => setShowMore(false)}
                className="touch-target text-muted-foreground hover:text-foreground rounded-xl"
                style={{ transform: "scale(0.8)" }}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {MORE_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-label text-muted-foreground mb-2 px-1">{group.label}</p>
                  <div className="grid grid-cols-5 gap-2">
                    {group.items.map(item => {
                      const active = location.pathname === item.path ||
                        (item.path !== "/" && location.pathname.startsWith(item.path));
                      return (
                        <button key={item.path}
                          onClick={() => { navigate(item.path); setShowMore(false); }}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition
                            ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`}>
                          {item.icon}
                          <span className="text-label text-center leading-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-surface-1/95 backdrop-blur-md border-t border-border z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex max-w-[600px] mx-auto h-[52px]">
          {MAIN_TABS.map(tab => {
            const active = tab.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(tab.path);
            return (
              <button key={tab.path} onClick={() => navigate(tab.path)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
                  ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="text-label leading-none mt-0.5">{tab.label}</span>
              </button>
            );
          })}
          <button onClick={() => setShowMore(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
              ${showMore ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <MoreHorizontal size={18} className="leading-none" />
            <span className="text-label leading-none mt-0.5">更多</span>
          </button>
        </div>
      </div>
    </>
  );
}
