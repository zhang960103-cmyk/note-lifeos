import SectionHeader from "../SectionHeader";
import Alert from "../Alert";
import CodeBlock from "../CodeBlock";

const CronTasks = () => (
  <div className="mt-14" id="cron">
    <SectionHeader num="⑥" title="定时提醒系统（OpenClaw Cron 替代 n8n 工作流C）" color="teal" />

    <Alert variant="green" icon="✅" title="为什么OpenClaw Cron更稳定">
      本地持久化存储，不依赖Railway加密 · 支持时区（迪拜 Asia/Dubai）· 电脑重启自动恢复 · 不需要配置WEBHOOK_URL
    </Alert>

    <CodeBlock title="bash · 5个Cron任务一次性配置（直接粘贴执行）">
{`# 早晨第1条：7:00 意识流唤醒
openclaw cron add \\
  --name "morning-free" \\
  --cron "0 7 * * *" \\
  --tz "Asia/Dubai" \\
  --session isolated \\
  --skill life-os/morning-free \\
  --announce \\
  --channel telegram

# 早晨第2条：7:30 结构化日记
openclaw cron add \\
  --name "morning-structured" \\
  --cron "30 7 * * *" \\
  --tz "Asia/Dubai" \\
  --session isolated \\
  --skill life-os/morning \\
  --announce \\
  --channel telegram

# 晚间复盘：21:30
openclaw cron add \\
  --name "evening-review" \\
  --cron "30 21 * * *" \\
  --tz "Asia/Dubai" \\
  --session isolated \\
  --skill life-os/evening \\
  --announce \\
  --channel telegram

# 每周日 20:00 周报
openclaw cron add \\
  --name "weekly-report" \\
  --cron "0 20 * * 0" \\
  --tz "Asia/Dubai" \\
  --session isolated \\
  --skill life-os/weekly-report \\
  --announce \\
  --channel telegram

# 每月1日 9:00 月报
openclaw cron add \\
  --name "monthly-report" \\
  --cron "0 9 1 * *" \\
  --tz "Asia/Dubai" \\
  --session isolated \\
  --skill life-os/monthly-report \\
  --announce \\
  --channel telegram

# 查看所有已配置的Cron
openclaw cron list`}
    </CodeBlock>

    <h3 className="font-serif-sc text-sm text-white mt-5 mb-2">算法路由代码（Skill入口，替代工作流B的JS节点）</h3>
    <CodeBlock title="~/.openclaw/skills/life-os/router.js · 关键词检测+算法路由">
{`const text = (input.text || '').toLowerCase();
const hour = new Date().getHours();
const emotionScore = input.emotionScore || 5;

// 关键词定义
const keywords = {
  fear:    ['担心','害怕','不敢','万一','后果','失败','拖延','不想'],
  future:  ['未来','方向','迷茫','不知道','选择','要不要','何去何从'],
  regret:  ['后悔','纠结','值不值','要不要','如果当时','早知道'],
  sad:     ['难受','崩溃','愤怒','委屈','伤心','绝望','好烦'],
  flow:    ['超级','很爽','心流','状态好','效率高','停不下来'],
};

// 指令路由（最高优先级）
if (input.command === '/now' || input.command === '/紧急') return 'emergency';
if (input.command === '/odyssey') return 'odyssey';
if (input.command === '/elder' || input.command === '/85岁') return 'solomon';
if (input.command === '/wheel') return 'wheel';
if (input.command === '/week') return 'weekly-report';
if (input.command === '/month') return 'monthly-report';
if (input.command === '/optimize') return 'optimize';

// 心流检测（优先）
if (emotionScore >= 9 || keywords.flow.some(w => text.includes(w))) return 'flow';

// 关键词路由
if (keywords.regret.some(w => text.includes(w))) return 'solomon';
if (keywords.future.some(w => text.includes(w))) return 'odyssey';
if (keywords.fear.some(w => text.includes(w))) return 'fear';
if (keywords.sad.some(w => text.includes(w))) return 'emotion';

// 时间路由（默认）
return hour < 14 ? 'morning' : 'evening';`}
    </CodeBlock>
  </div>
);

export default CronTasks;
