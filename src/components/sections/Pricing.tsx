import SectionHeader from "../SectionHeader";
import Alert from "../Alert";

const plans = [
  {
    label: "入门版",
    price: "¥99",
    name: "纯云版",
    sub: "无需本地部署",
    features: ["全套Skill提示词", "Notion数据库模板", "图文安装教程", "DeepSeek API版本"],
    featured: false,
  },
  {
    label: "⭐ 主力版",
    price: "¥299",
    name: "完整Life OS",
    sub: "30分钟跑起来",
    features: ["8大算法全套", "傻瓜向导安装页", "视频教程", "3次提问支持", "终身更新推送"],
    featured: true,
  },
  {
    label: "定制版",
    price: "¥999+",
    name: "1对1定制",
    sub: "你的背景个性化",
    features: ["远程1对1部署", "个性化提示词定制", "1个月支持", "迪拜/脱口秀等特定场景"],
    featured: false,
  },
];

const timeline = [
  ["自己跑通3个月，截图记录改变", "现在→3个月", "积累内容素材"],
  ["小红书/即刻发"AI日记改变了我什么"", "第3个月", "流量积累"],
  ["发布¥99入门版，测试转化率", "第4个月", "目标30单=¥2970"],
  ["根据反馈迭代，升级¥299版", "第5个月", "目标20单=¥5980"],
  ["¥999定制版给高端用户", "第6个月起", "10单/月=¥9990"],
];

const Pricing = () => (
  <div className="mt-14" id="sell">
    <SectionHeader num="⑨" title="商业化定价与出售方案" color="orange" />

    <Alert variant="gold" icon="⚖️" title="v4.1比v4.0更好卖">
      MIT License可商业化 · 无硬伤不报错 · 买家30分钟跑起来 · 你的独特卖点（迪拜+脱口秀+AI开发背景）复制不了
    </Alert>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
      {plans.map((plan) => (
        <div key={plan.name} className={`border rounded-xl p-5 text-center ${plan.featured ? "border-gold-border bg-gold-light" : "bg-surface-2 border-border"}`}>
          <div className="font-mono-jb text-[9px] uppercase text-muted-foreground tracking-wide">{plan.label}</div>
          <div className="font-serif-sc text-3xl text-gold my-2">{plan.price}</div>
          <h3 className="font-serif-sc text-sm text-white mb-1">{plan.name}</h3>
          <p className="text-[11px] text-muted-foreground mb-3">{plan.sub}</p>
          <ul className="text-left pl-3.5 mt-3">
            {plan.features.map((f) => (
              <li key={f} className="text-[11px] text-muted-foreground mb-1 list-none pl-1 before:content-['✓_'] before:text-los-green">{f}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {["变现路径", "时间节点", "预计收入"].map((h) => (
              <th key={h} className="text-left p-2.5 px-3 bg-surface-3 text-muted-foreground font-mono-jb text-[9px] uppercase tracking-wider border-b-2 border-border">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeline.map(([path, time, income]) => (
            <tr key={path} className="hover:bg-surface-2 transition-colors">
              <td className="p-2.5 px-3 border-b border-border text-foreground">{path}</td>
              <td className="p-2.5 px-3 border-b border-border text-muted-foreground">{time}</td>
              <td className="p-2.5 px-3 border-b border-border text-muted-foreground">{income}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default Pricing;
