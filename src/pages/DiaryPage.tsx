import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { routeAlgorithm } from "@/lib/algorithmRouter";
import { ALGORITHM_INFO, ALL_DOMAINS, type AlgorithmType, type LifeDomain, type Task } from "@/types/lifeOs";
import { ArrowLeft, Send, Plus, X } from "lucide-react";

const DiaryPage = () => {
  const { addEntry } = useLifeOs();
  const navigate = useNavigate();

  const [content, setContent] = useState("");
  const [emotionScore, setEmotionScore] = useState(5);
  const [happinessScore, setHappinessScore] = useState(5);
  const [selectedDomains, setSelectedDomains] = useState<LifeDomain[]>([]);
  const [keywordsText, setKeywordsText] = useState("");
  const [manualAlgo, setManualAlgo] = useState<AlgorithmType | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newTaskType, setNewTaskType] = useState<"建系统" | "卖时间">("建系统");
  const [showAlgoPicker, setShowAlgoPicker] = useState(false);

  const detectedAlgo = useMemo(() => routeAlgorithm(content, emotionScore), [content, emotionScore]);
  const activeAlgo = manualAlgo || detectedAlgo;
  const algoInfo = ALGORITHM_INFO[activeAlgo];

  const toggleDomain = (d: LifeDomain) => {
    setSelectedDomains((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : prev.length < 3 ? [...prev, d] : prev
    );
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), text: newTask.trim(), type: newTaskType, completed: false }]);
    setNewTask("");
  };

  const removeTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const handleSubmit = () => {
    if (!content.trim()) return;
    const keywords = keywordsText
      .split(/[,，、\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    addEntry({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      content: content.trim(),
      algorithm: activeAlgo,
      domains: selectedDomains,
      keywords,
      emotionScore,
      happinessScore,
      tasks,
    });

    navigate("/");
  };

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif-sc text-lg text-white flex-1">写日记</h1>
      </div>

      {/* Algorithm Badge */}
      <button
        onClick={() => setShowAlgoPicker(!showAlgoPicker)}
        className="flex items-center gap-2 bg-gold-light border border-gold-border rounded-full px-3 py-1.5 mb-4 hover:bg-gold/10 transition-all"
      >
        <span>{algoInfo.icon}</span>
        <span className="text-gold text-xs font-mono-jb">{algoInfo.name}</span>
        <span className="text-[9px] text-muted-foreground font-mono-jb">
          {manualAlgo ? "手动" : "自动检测"}
        </span>
      </button>

      {/* Algorithm Picker */}
      {showAlgoPicker && (
        <div className="bg-surface-2 border border-border rounded-xl p-3 mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => { setManualAlgo(null); setShowAlgoPicker(false); }}
            className={`text-left p-2 rounded-lg text-xs transition-all ${!manualAlgo ? "bg-gold-light border border-gold-border text-gold" : "text-muted-foreground hover:bg-surface-3"}`}
          >
            🤖 自动检测
          </button>
          {(Object.entries(ALGORITHM_INFO) as [AlgorithmType, typeof algoInfo][]).map(([key, info]) => (
            <button
              key={key}
              onClick={() => { setManualAlgo(key); setShowAlgoPicker(false); }}
              className={`text-left p-2 rounded-lg text-xs transition-all ${manualAlgo === key ? "bg-gold-light border border-gold-border text-gold" : "text-muted-foreground hover:bg-surface-3"}`}
            >
              {info.icon} {info.name}
            </button>
          ))}
        </div>
      )}

      {/* Content Input */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="说说今天发生了什么..."
        className="w-full bg-surface-2 border border-border rounded-xl p-4 text-foreground text-sm leading-relaxed placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-gold-border transition-colors min-h-[180px]"
      />

      {/* Emotion & Happiness Scores */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-surface-2 border border-border rounded-xl p-3">
          <label className="text-[10px] text-muted-foreground font-mono-jb uppercase tracking-wider block mb-2">
            💭 情绪强度 <span className="text-gold">{emotionScore}</span>
          </label>
          <input
            type="range" min={1} max={10} value={emotionScore}
            onChange={(e) => setEmotionScore(+e.target.value)}
            className="w-full accent-gold h-1"
          />
        </div>
        <div className="bg-surface-2 border border-border rounded-xl p-3">
          <label className="text-[10px] text-muted-foreground font-mono-jb uppercase tracking-wider block mb-2">
            😊 幸福度 <span className="text-gold">{happinessScore}</span>
          </label>
          <input
            type="range" min={1} max={10} value={happinessScore}
            onChange={(e) => setHappinessScore(+e.target.value)}
            className="w-full accent-gold h-1"
          />
        </div>
      </div>

      {/* Domain Tags */}
      <div className="mt-4">
        <div className="text-[10px] text-muted-foreground font-mono-jb uppercase tracking-wider mb-2">领域标签（选1-3）</div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_DOMAINS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDomain(d)}
              className={`text-[11px] px-2.5 py-1 rounded-md font-mono-jb transition-all ${
                selectedDomains.includes(d)
                  ? "bg-gold text-background"
                  : "bg-surface-2 border border-border text-muted-foreground hover:border-gold-border hover:text-gold"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Keywords */}
      <div className="mt-4">
        <div className="text-[10px] text-muted-foreground font-mono-jb uppercase tracking-wider mb-2">关键词（逗号分隔）</div>
        <input
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          placeholder="例如：成长，思考，迪拜"
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold-border"
        />
      </div>

      {/* Tasks */}
      <div className="mt-4">
        <div className="text-[10px] text-muted-foreground font-mono-jb uppercase tracking-wider mb-2">任务清单（3+2规则）</div>
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-3 py-2 mb-1.5 text-xs">
            <span className={`text-[9px] font-mono-jb px-1.5 py-0.5 rounded ${task.type === "建系统" ? "bg-los-green-light text-los-green" : "bg-los-blue-light text-los-blue"}`}>
              {task.type}
            </span>
            <span className="text-foreground flex-1">{task.text}</span>
            <button onClick={() => removeTask(task.id)} className="text-muted-foreground hover:text-los-red">
              <X size={14} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <select
            value={newTaskType}
            onChange={(e) => setNewTaskType(e.target.value as "建系统" | "卖时间")}
            className="bg-surface-2 border border-border rounded-lg px-2 py-2 text-[10px] text-foreground font-mono-jb focus:outline-none"
          >
            <option value="建系统">建系统</option>
            <option value="卖时间">卖时间</option>
          </select>
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="添加任务..."
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold-border"
          />
          <button onClick={addTask} className="bg-surface-2 border border-border rounded-lg px-3 hover:border-gold-border text-muted-foreground hover:text-gold transition-all">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!content.trim()}
        className="w-full mt-6 bg-gold text-background font-serif-sc text-sm py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-30 hover:bg-gold/90 transition-all"
      >
        <Send size={16} />
        保存日记
      </button>
    </div>
  );
};

export default DiaryPage;
