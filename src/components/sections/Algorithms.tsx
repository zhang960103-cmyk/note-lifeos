import SectionHeader from "../SectionHeader";
import Alert from "../Alert";
import AlgoCard from "../AlgoCard";

const algos = [
  { num: "01", tag: "日常", variant: "gold" as const, icon: "📖", title: "生活作业", desc: "捕捉每日最有故事价值的瞬间，构建人生叙事资产库。", trigger: "默认 | /story" },
  { num: "02", tag: "晨间", variant: "blue" as const, icon: "🌅", title: "晨间笔记", desc: "清晨15分钟无压力意识流，捕捉潜意识最真实的声音。Morning Pages方法。", trigger: "7:00 AM 第一条提醒" },
  { num: "03", tag: "情绪", variant: "red" as const, icon: "💔", title: "心情日记", desc: "记录痛苦与混乱，情绪排毒。不分析，只见证。先承认，再提问。", trigger: "难受/崩溃/愤怒/委屈/伤心" },
  { num: "04", tag: "正向", variant: "green" as const, icon: "🙏", title: "感恩日记", desc: "强制关注美好，每日3件感恩，提升底层心理能量基线，科学证明有效。", trigger: "早晨结构化日记固定包含" },
  { num: "05", tag: "长线", variant: "purple" as const, icon: "🚀", title: "奥德赛计划", desc: "斯坦福方法：设想5年后的3条不同人生路径，驱动长线战略布局。", trigger: "未来/方向/迷茫/不知道 | /odyssey" },
  { num: "06", tag: "平衡", variant: "teal" as const, icon: "⚖️", title: "生命之轮", desc: "7大领域各维度打分，可视化生命平衡度，识别哪个维度是空白。", trigger: "周复盘固定 | /wheel" },
  { num: "07", tag: "恐惧", variant: "red" as const, icon: "😨", title: "恐惧设定", desc: "Tim Ferriss框架：直面害怕的事，写最坏情况、预防和补救。消解拖延根源。", trigger: "担心/害怕/不敢/万一 | 任务3天未动" },
  { num: "08", tag: "智慧", variant: "gold" as const, icon: "👴", title: "所罗门悖论", desc: "模拟85岁的自己回望今天，获得跨时空高维视角。打破局限性自我认知。", trigger: "后悔/纠结/值不值/要不要 | /elder" },
];

const Algorithms = () => (
  <div className="mt-14" id="algos">
    <SectionHeader num="③" title="八大日记算法（全部保留，自动切换）" color="gold" />

    <Alert variant="blue" icon="🎯" title="核心卖点之一">
      AI根据消息关键词、情绪分、时间、指令自动切换算法。用户无需手动选择，系统比用户更懂"现在用哪个算法最合适"。
    </Alert>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      {algos.map((algo) => (
        <AlgoCard key={algo.num} {...algo} />
      ))}
    </div>
  </div>
);

export default Algorithms;
