import SectionHeader from "../SectionHeader";
import Alert from "../Alert";
import PromptBlock from "../PromptBlock";

const periods = [
  { icon: "📅", title: "每周日", desc: "20:00自动\n/week随时触发", featured: false },
  { icon: "🗓️", title: "每月1日", desc: "9:00自动\n/month随时触发", featured: false },
  { icon: "🌿", title: "每季度", desc: "1/4/7/10月\n/quarter触发", featured: false },
  { icon: "🎆", title: "每年元旦", desc: "1月1日\n/year触发", featured: false },
  { icon: "⚡", title: "任意时刻", desc: "发指令即触发\n无需等待", featured: true },
];

const PeriodicReview = () => (
  <div className="mt-14" id="periodic">
    <SectionHeader num="⑦" title="周·月·季·年复盘（auto-daily-report适配）" color="white" />

    <Alert variant="gold" icon="💡" title="直接使用现成开源项目">
      GitHub: <code className="font-mono-jb text-[10px] text-gold">auto-daily-report</code> 项目已实现周月报核心逻辑，把提示词模板替换为下方内容 + 修改Notion字段映射，1-2小时完成适配。
    </Alert>

    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 my-4">
      {periods.map((p) => (
        <div key={p.title} className={`border rounded-lg p-3 py-3 text-center ${p.featured ? "bg-gold border-gold" : "bg-surface-2 border-border"}`}>
          <div className="text-xl mb-1">{p.icon}</div>
          <div className={`font-serif-sc text-[11px] mb-1 ${p.featured ? "text-background" : "text-gold"}`}>{p.title}</div>
          <div className={`text-[9px] leading-snug whitespace-pre-line ${p.featured ? "text-background/60" : "text-muted-foreground"}`}>{p.desc}</div>
        </div>
      ))}
    </div>

    <PromptBlock title="weekly-report.md · 周度复盘">
{`你是用户的周度人生教练。基于本周7天Notion日记数据生成报告：

📊 本周数据看板
• 平均幸福度：X/10（最高X[日期]，最低X[日期]）
• 7大领域分布：各领域记录次数
• 杠杆比：建系统X% / 卖时间X%
• 使用算法分布：各模式触发次数

⚖️ 生命之轮本周评分
学习X | 感情X | 家庭X | 事业X | 健康X | 社交X | 意义X
[哪个维度本周最空白？连续3天未记录则强制引导补齐]

🔍 本周重复模式（中立语言，不评判）
[反复出现的行为/情绪/思维]

🏆 本周成就（无论大小）

⚡ 杠杆机会
[本周重复做的哪些事可以系统化、自动化或外包？]

🔄 反直觉挑战
[本周你的某个信念，反过来想会发现什么？]

🌍 迪拜视角
[本周有什么事可以用你的迪拜位置放大？]

🧪 下周1个实验（具体可验证，以实验心态）

💌 本周寄语（100字以内，像老友写给你的信）`}
    </PromptBlock>

    <PromptBlock title="monthly-report.md · 月度人生报告">
{`你是用户的月度人生导师。基于本月所有日记数据：

📈 月度数据面板
• 月均幸福度 X/10
• 7大领域分布（%）
• 杠杆比：建系统X% / 卖时间X%
• 本月高频词Top5（正面/负面各列）
• 算法使用分布（8种各触发几次）

🧠 认知模式分析
[主导思维模式：成长型？固定型？常见认知偏差？]

🎯 目标完成度
[月初设定 vs 实际完成，卡在哪里？原因？]

⚡ 系统化机会
[本月重复做的事里，哪3件可以自动化/外包/系统化？]

🌍 迪拜本地化洞察
[本月哪些事与迪拜市场机会相关？有没有被忽视的杠杆点？]

🏛️ 导师的话（200字以内，私人信件风格，结合具体事件）

🎯 下月3大主题（具体可操作，不是口号）`}
    </PromptBlock>
  </div>
);

export default PeriodicReview;
