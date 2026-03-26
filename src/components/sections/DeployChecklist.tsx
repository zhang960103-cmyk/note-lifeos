import SectionHeader from "../SectionHeader";
import Alert from "../Alert";

const days = [
  {
    id: "D1",
    color: "border-gold-border text-gold",
    day: "第一天 · 基础设施",
    title: "Telegram + OpenClaw + Notion",
    items: [
      "@BotFather 创建Bot，获取Token",
      "@userinfobot 获取你的Chat ID",
      "OpenClaw安装：npm install -g openclaw",
      "配置Telegram：openclaw config set telegram.token YOUR_TOKEN",
      "Notion创建日记数据库，获取Database ID",
      "安装Notion Skill：npx clawhub install notion",
      "DeepSeek注册获取API Key（备用模型）",
    ],
  },
  {
    id: "D2",
    color: "border-los-green/40 text-los-green",
    day: "第二天 · Skill配置",
    title: "提示词 + 算法路由 + Cron",
    items: [
      "创建目录：mkdir -p ~/.openclaw/skills/life-os",
      "把MASTER PROMPT存为：system.md",
      "把6个算法提示词各存为对应.md文件",
      "把router.js存为入口路由",
      "配置5个Cron定时任务（复制上方命令执行）",
      "Cloudflare Tunnel一次性配置（固定本地域名）",
    ],
  },
  {
    id: "D3",
    color: "border-los-blue/40 text-los-blue",
    day: "第三天 · 测试验证",
    title: "全链路测试通过",
    items: [
      '发"你好"→测试基础回复',
      '发"/now 今天很烦"→测试急救模式',
      "发语音→测试Whisper转录",
      '发"好担心未来方向"→测试奥德赛触发',
      "说一件感恩的事，情绪打9分→测试心流捕捉",
      "关电脑，手机发消息→测试DeepSeek备用",
      "查看Notion数据库，确认条目已存入",
      "手动触发/week，测试周报",
    ],
  },
  {
    id: "D5",
    color: "border-los-purple/40 text-los-purple",
    day: "第五天 · auto-daily-report适配",
    title: "周月年复盘自动化",
    items: [
      "Clone auto-daily-report项目",
      "把weekly/monthly提示词替换为本文档版本",
      "修改config.json填入你的Notion Database ID",
      "测试/week和/month指令",
    ],
  },
];

const errors = [
  ["Telegram收不到消息", "Bot没有先收到你的消息", "先给Bot发一条任意消息激活"],
  ["Notion写入失败", "Integration未连接数据库", "Notion数据库右上角···→Add connections"],
  ["Whisper转录乱码", "未指定语言", "配置language=zh参数"],
  ["Ollama连接失败", "Docker内访问宿主机", "改用host.docker.internal或配置环境变量"],
  ["Cron没有触发", "时区配置错误", '确认--tz "Asia/Dubai"，迪拜是UTC+4'],
];

const DeployChecklist = () => (
  <div className="mt-14" id="deploy">
    <SectionHeader num="⑩" title="部署清单：按顺序执行（预计2小时）" color="red" />

    <div className="flex flex-col gap-0 my-4">
      {days.map((d, i) => (
        <div key={d.id} className="flex gap-4 pb-5 relative">
          {i < days.length - 1 && (
            <div className="absolute left-[15px] top-7 w-0.5 bg-border bottom-0" />
          )}
          <div className={`w-[30px] h-[30px] rounded-full flex-shrink-0 flex items-center justify-center font-mono-jb text-[10px] border-2 bg-surface-2 z-10 ${d.color}`}>
            {d.id}
          </div>
          <div>
            <div className="font-mono-jb text-[9px] text-gold uppercase tracking-wide">{d.day}</div>
            <h4 className="text-[13px] text-white mb-1 font-medium">{d.title}</h4>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {d.items.map((item) => (
                <div key={item}>□ {item}</div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="overflow-x-auto mt-4">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {["常见报错", "原因", "解决"].map((h) => (
              <th key={h} className="text-left p-2.5 px-3 bg-surface-3 text-muted-foreground font-mono-jb text-[9px] uppercase tracking-wider border-b-2 border-border">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {errors.map(([err, cause, fix]) => (
            <tr key={err} className="hover:bg-surface-2 transition-colors">
              <td className="p-2.5 px-3 border-b border-border text-foreground">{err}</td>
              <td className="p-2.5 px-3 border-b border-border text-muted-foreground">{cause}</td>
              <td className="p-2.5 px-3 border-b border-border text-muted-foreground">{fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <Alert variant="green" icon="🎯" title="2年稳定性保障">
      ✅ 所有提示词存本地文件，随时修改，无长度限制<br />
      ✅ OpenClaw MIT License，核心稳定，可商业化<br />
      ✅ 模型切换只需改一行配置（Qwen换新版/DeepSeek升级）<br />
      ✅ Notion字段设计向后兼容<br />
      ✅ /optimize每月自动生成系统升级建议，半自动进化
    </Alert>
  </div>
);

export default DeployChecklist;
