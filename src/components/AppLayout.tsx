import { NavLink, Outlet } from "react-router-dom";
import { Home, PenLine, Clock, BarChart3, Target, MessageCircle, Timer, Compass } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "首页" },
  { to: "/diary", icon: PenLine, label: "日记" },
  { to: "/mentor", icon: MessageCircle, label: "导师" },
  { to: "/wheel", icon: Target, label: "之轮" },
  { to: "/review", icon: BarChart3, label: "复盘" },
  { to: "/cron", icon: Timer, label: "定时" },
  { to: "/history", icon: Clock, label: "历史" },
];

const AppLayout = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Outlet />
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-1/97 backdrop-blur-md border-t border-border z-50">
      <div className="max-w-[700px] mx-auto flex items-center justify-around py-2 px-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all text-[9px] font-mono-jb ${
                isActive ? "text-gold" : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  </div>
);

export default AppLayout;
