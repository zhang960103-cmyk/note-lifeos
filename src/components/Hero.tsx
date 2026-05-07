const Hero = () => (
  <header className="bg-surface-1 border-b border-border py-14 px-6 text-center relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none" style={{
      background: 'radial-gradient(ellipse at 25% 60%, hsl(39 58% 53% / 0.07), transparent 55%), radial-gradient(ellipse at 78% 25%, hsl(268 48% 63% / 0.05), transparent 50%), radial-gradient(ellipse at 50% 100%, hsl(152 41% 49% / 0.04), transparent 50%)'
    }} />
    <div className="relative z-10">
      <div className="inline-flex items-center gap-2 border border-gold-border text-gold px-4 py-1 rounded-full font-mono-jb text-[9px] tracking-[2px] uppercase mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-los-green animate-pulse-dot" />
        v4.1 · n8n硬伤修复 + OpenClaw架构 · 全卖点保留
      </div>
      <h1 className="font-serif-sc text-4xl md:text-[2.5rem] font-bold text-white leading-tight mb-2">
        生命罗盘<br /><span className="text-gold">Life OS v4.1</span>
      </h1>
      <p className="text-muted-foreground text-[11px] font-mono-jb mb-3">白皮书v4.0 + Flowith审查报告 · 终极合并版</p>
      <p className="text-muted-foreground/70 text-[13px] max-w-[560px] mx-auto mb-6">
        8大日记算法 · 防AI偏见 · 7大人生领域 · OpenClaw稳定架构<br />
        迪拜文化滤镜 · 5大灵魂补丁 · 可商业化出售
      </p>
      <div className="flex justify-center gap-7 flex-wrap">
        {[
          ["8", "日记算法"], ["7", "人生领域"], ["7", "n8n硬伤已修"], ["5", "灵魂补丁"], ["2年", "稳定保障"]
        ].map(([num, label]) => (
          <div key={label} className="text-center">
            <div className="font-serif-sc text-3xl text-gold leading-none">{num}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide font-mono-jb mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  </header>
);

export default Hero;
