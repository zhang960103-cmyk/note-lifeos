const navItems = [
  { href: "#why", label: "①为何升级" },
  { href: "#arch", label: "②新架构" },
  { href: "#algos", label: "③八大算法" },
  { href: "#master", label: "④主提示词" },
  { href: "#algo-prompts", label: "⑤算法提示词" },
  { href: "#cron", label: "⑥定时任务" },
  { href: "#periodic", label: "⑦周月年复盘" },
  { href: "#patch", label: "⑧灵魂补丁" },
  { href: "#sell", label: "⑨商业化" },
  { href: "#deploy", label: "⑩部署清单" },
];

const Navbar = () => (
  <nav className="sticky top-0 z-50 bg-background/97 backdrop-blur-md border-b border-border flex items-center px-4 h-[42px] gap-0.5 overflow-x-auto scrollbar-none">
    <span className="font-serif-sc text-xs text-gold whitespace-nowrap mr-3 flex-shrink-0">🧭 Life OS v4.1</span>
    {navItems.map((item) => (
      <a
        key={item.href}
        href={item.href}
        className="text-muted-foreground no-underline text-[10px] px-2.5 py-1 rounded flex-shrink-0 font-mono-jb tracking-wide hover:text-gold hover:bg-gold-light transition-all whitespace-nowrap"
      >
        {item.label}
      </a>
    ))}
  </nav>
);

export default Navbar;
