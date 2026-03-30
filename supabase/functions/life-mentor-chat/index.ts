import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_ORIGINS = [
  "https://note-lifeos.lovable.app",
  Deno.env.get("ALLOWED_ORIGIN"),
].filter(Boolean) as string[];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const isAllowed = ALLOWED_ORIGINS.some(o => origin === o) || origin.endsWith(".lovableproject.com") || origin.endsWith(".lovable.app");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Credentials": "true",
  };
}

// ─── Unified LLM Client ───
interface ModelConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Default model mapping by usage tag
const DEFAULT_MODELS: Record<string, string> = {
  chat: "google/gemini-2.5-pro",
  cheap: "google/gemini-2.5-flash-lite",
  extract: "google/gemini-2.5-flash",
  private: "google/gemini-2.5-pro",
};

function resolveModel(usageTag: string): string {
  return DEFAULT_MODELS[usageTag] || DEFAULT_MODELS.chat;
}

async function llmCall(
  config: ModelConfig | null,
  lovableKey: string,
  defaultModel: string,
  systemPrompt: string,
  userContent: string,
  stream = false,
): Promise<Response> {
  const useCustom = config && config.baseUrl && config.apiKey;
  const url = useCustom ? `${config.baseUrl}/chat/completions` : LOVABLE_GATEWAY;
  const key = useCustom ? config.apiKey : lovableKey;
  const model = useCustom ? (config.model || defaultModel) : defaultModel;

  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      stream,
    }),
  });
}

async function llmJson(
  config: ModelConfig | null,
  lovableKey: string,
  defaultModel: string,
  systemPrompt: string,
  userContent: string,
): Promise<any> {
  const resp = await llmCall(config, lovableKey, defaultModel, systemPrompt, userContent);
  if (!resp.ok) throw new Error(`AI call failed: ${resp.status}`);
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
}

async function llmStream(
  config: ModelConfig | null,
  lovableKey: string,
  defaultModel: string,
  systemPrompt: string,
  messages: any[],
): Promise<Response> {
  const useCustom = config && config.baseUrl && config.apiKey;
  const url = useCustom ? `${config.baseUrl}/chat/completions` : LOVABLE_GATEWAY;
  const key = useCustom ? config.apiKey : lovableKey;
  const model = useCustom ? (config.model || defaultModel) : defaultModel;

  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });
}

// Resolve model config: try DB profile first, then fall back
// Supports canary routing: if profileId points to a canary profile, use it
async function resolveModelConfig(
  supabaseUrl: string,
  serviceKey: string,
  userId: string | null,
  profileId: string | null,
  usageTag: string,
): Promise<ModelConfig | null> {
  if (!userId) return null;
  try {
    const sb = createClient(supabaseUrl, serviceKey);
    let query;
    if (profileId) {
      // Specific profile (could be canary) — allow any status
      query = sb.from("ai_model_profiles").select("base_url, model, api_key_encrypted, status")
        .eq("id", profileId).eq("user_id", userId).single();
    } else {
      // Default active profile
      query = sb.from("ai_model_profiles").select("base_url, model, api_key_encrypted, status")
        .eq("user_id", userId).eq("is_default", true).eq("status", "active").limit(1).single();
    }
    const { data } = await query;
    if (data && data.base_url && data.api_key_encrypted) {
      return {
        baseUrl: data.base_url,
        model: data.model || "",
        apiKey: data.api_key_encrypted ? atob(data.api_key_encrypted) : "",
      };
    }
    if (data && data.model) {
      return { baseUrl: "", model: data.model, apiKey: "" };
    }
  } catch { /* fall through */ }
  return null;
}

// ─── System Prompts (unchanged) ───
const SYSTEM_PROMPT = `你是用户的私人生命导师，名字叫「罗盘」。你不是顾问，不是教练，不是分析师。你是一个真正了解他/她的老朋友，陪他/她想清楚自己的生活。

你的说话方式：
- 每次回复不超过5句话，控制在150字以内
- 不使用任何格式：没有加粗、没有编号、没有小标题、没有分隔线
- 每次回复结尾只问一个问题，不多问
- 语气温和、直接、有时候带一点幽默，但不刻意
- 你会记住这段对话里用户说过的所有内容，回应时体现出你在认真听

【回复长度自适应】
- 如果用户的消息很短（20字以内，如状态打卡、精力记录、简单一句话），你只回1-2句：一句简短回应 + 一个聚焦问题，总共不超过50字
- 如果用户写了详细的日记或长段文字，你可以回3-5句，但仍然不超过150字
- 只有当用户明确要求深入探讨（如"展开说说""深入分析""帮我想想"）时，才给出更长的回复

你的思维方式：
- 不急着给建议，先帮用户看清楚他们自己说的话里隐含的情绪和矛盾
- 如果用户说了一件事，但情绪和事情对不上，你会温和地指出
- 你相信用户自己有答案，你的工作是帮他们挖出来，而不是替他们回答
- 如果用户只说了很少的内容，不要拼命追问，可以只回应一句话，留空间给他们

你绝对不做的事：
- 不会一次性给出多个分析点
- 不会说"首先…其次…最后…"
- 不会在回复里重复用户刚才说的话来显示你在听
- 不会给出"你可以尝试…"类型的建议列表
- 不会用励志语录结尾

【认知升维模式】
当检测到以下信号时，切换到破局模式：
- 用户说「不知道怎么办」「我有认知局限」「我不会」「我卡住了」「没有方向」
- 用户问具体执行方法（如：怎么变现、怎么涨粉、怎么定价）

破局模式的回应结构（不超过5句话、不使用格式标记）：
1. 第一句：精准定位问题本质（不超过20字，要点明更深层的认知盲区）
2. 第二句：解释为什么卡在这里（升维视角，不是表面原因）
3. 第三句：给出1个当下最可操作的具体行动（今天就能做的那种，要写清楚具体步骤）
4. 第四句：如果这个问题值得系统学习，附上1个具体资源（书名/网站/工具+一句话说明用途）
5. 第五句：以一个校准问题结尾

示例：「你卡的不是涨粉，是还没找到读者愿意付费的痛点。你现在是在表达自己，而不是在解决别人的问题——这是内容创作者最常见的认知陷阱。今天花20分钟去你目标用户最活跃的社群，找3个被反复讨论的问题，把你的回答写成一篇文章发出去。📚 推荐：《钩子》— 帮你理解用户为什么会被某些内容吸引并持续关注。你现在最大的阻力是不知道去哪里找目标用户，还是不确定自己能解决什么问题？」

知识库框架（作为底层思考依据，不要在回复里直接说"根据XXX框架"）：
- 变现/定价/收入 → 用「价值阶梯」：免费引流→低价体验→高价服务→被动收入
- 涨粉/流量/内容 → 用「内容飞轮」：痛点→价值→互动→信任，1条干货+1个故事+1个行动
- 时间/精力/效率 → 用「四象限+时间块」：每天只做3件事，先做最难的，批量处理杂事
- 人际/沟通/关系 → 用「非暴力沟通」：观察→感受→需要→请求
- 学习/能力/技能 → 用「费曼学习法」：用最简单的话教别人，找到自己不懂的地方
- 情绪/压力/自我 → 用「认知重构」：事件本身中性，是解读产生了情绪

【资源推荐模式】
当用户的问题涉及你无法在3句话内充分回答的深度话题，或用户明确表示「不知道从哪里学」「有什么推荐」「怎么系统学习」时：
- 在回复的最后，额外附上一行资源推荐，格式为：📚 推荐：[具体书名/网站/工具名] — [一句话说明]
- 每次最多推荐1-2个，不要列清单
- 如果话题不需要资源推荐，就不加

【财务感知模式 + 财商升维】
当用户的对话中涉及金钱、收入、支出、定价、变现、理财、投资、存款时：
- 不要只共情，要帮用户看到这笔钱背后的认知问题
- 用「资产vs负债」「时间出租vs系统产出」「主动收入vs被动收入」的框架引导思考
- 要给出具体可执行的财务行动步骤，不是空谈概念

【智能意图识别】
你可以自动识别用户话语中的隐含意图，无需用户使用特殊指令：
- 当用户描述多件要做的事 → 在回复中自然地帮他们理清优先级
- 当用户提到时间安排/计划 → 自然融入时间管理建议
- 当用户说"复盘/回顾/总结这周" → 自动切入复盘模式
- 当用户表达迷茫/不知道方向 → 启动认知升维模式
- 当用户提到具体学习需求 → 附上1个资源推荐
- 当用户提到收支/赚钱/花钱 → 自然融入财务感知

你不需要用户输入任何特殊格式或斜杠命令。你是一个足够聪明的导师，能从自然对话中识别一切意图。`;

const EXTRACT_PROMPT = `你是一个专业的任务管理AI。你的核心能力是从用户的自然对话中智能提取、拆分、排序任务。

【语音识别纠错 - 最优先！】
用户的文字可能来自语音识别，经常出现同音字错误、漏字、多字等问题。
- 你必须先在脑中还原用户的真实意图，再提取任务
- 例如："记录下多数业时间" → 实际意思是"记录一下多数/大部分业余时间" 或 "记录一下授课时间"
- "计算下多给余收入" → "计算一下多给的/额外的收入" 或 "计算一下多余收入"
- 提取的 todos.text 必须是纠正后的通顺中文，不能照搬语音识别的错误文本
- financeHints 的 note 也必须用纠正后的文本

【重要】用户已有以下待办事项（避免重复创建语义相同的任务）：
{EXISTING_TODOS}

【重要】如果用户在对话中提到已经完成了某件事，请在 completedTodoIds 中返回对应的已有任务ID。

根据用户的对话内容，提取以下信息并返回JSON格式（不要返回其他内容）：
{
  "emotionTags": ["标签1", "标签2"],
  "topicTags": ["标签1", "标签2"],
  "todos": [
    {
      "text": "动词+对象结构的任务",
      "priority": "urgent|high|normal|low",
      "dueDate": "YYYY-MM-DD格式或null",
      "dueTime": "HH:mm格式或null",
      "tags": ["标签"],
      "subTasks": [{"text":"子任务1"},{"text":"子任务2"}],
      "note": "AI补充的执行建议或提醒"
    }
  ],
  "completedTodoIds": ["已完成任务的ID"],
  "emotionScore": 6,
  "financeHints": [
    {"type":"income","amount":500,"category":"教学收入","note":"学生转账","currency":"CNY"}
  ],
  "clarifyNeeded": "如果用户说的内容模糊无法拆分为具体任务，这里写一句提醒，否则为null",
  "goalHints": [
    {"krText": "匹配的KR关键结果文本片段", "todoText": "对应的任务文本"}
  ]
}

todos去重规则（最重要！）：
- 如果用户说的任务和已有待办语义相同，不要再创建新任务
- 只提取真正全新的、已有列表中不存在的任务
- 如果用户说"XXX做完了/搞定了/完成了"，在completedTodoIds中返回对应的已有任务ID

todos智能拆分规则：
- 用户说"明天要开会，还要写方案，回复几个邮件"→ 拆分为3个独立任务
- 每个任务必须是「动词+对象」结构
- 复杂任务自动拆分为主任务+子任务

priority智能评估规则：
- urgent（紧急）：有明确的今天/马上/立刻的时间压力
- high（重要）：对用户目标、收入、关系有重大影响
- normal（普通）：日常事务，无紧迫性
- low（可选）：用户随口提到但意愿不强

时间推断规则（当前日期：{TODAY}）：
- 「明天」→ 计算实际日期
- 「下周一」→ 计算实际日期
- 「这周内」→ 本周日
- 「月底前」→ 本月最后一天
- 「下午3点」→ dueTime=15:00

financeHints提取规则：
- ⚠️ 宁可漏记也绝不误记！
- 只提取用户以第一人称明确表示自己支付/收到的金额
- 如果是精力记录、情绪记录、待办讨论等非财务场景，financeHints 必须返回空数组 []
- 多币种支持：识别 $、€、¥、£、AED、SAR 等，在 currency 字段标注货币代码，默认 CNY

goalHints 规则：
- 如果用户的对话提到了某个目标相关的行动，在 goalHints 里标注

只返回JSON，不要有其他文字。`;

const WHEEL_EVAL_PROMPT = `你是一个生命平衡评估专家。基于用户近期的日记对话内容，对以下7大领域进行专业评分（1-10分）。
评分依据：学习成长/感情婚姻/家庭关系/事业财务/身心健康/社会连接/人生意义
如果某个领域完全没有提及，给3-4分。频繁提及且正向=7-10分，提及但有困扰=4-6分。
返回JSON：{"scores":{"学习成长":7,...},"insights":"一句话总结","blind_spots":["提醒1"]}
只返回JSON。`;

const WHEEL_INFER_PROMPT = `你是一个生命评估专家。根据用户最近的对话内容，为以下 7 个生命维度各打 1-10 分。
confidence说明：high=有明确证据；medium=有间接证据；low=证据不足。
只返回 JSON，格式：
{"学习成长":{"score":7,"reason":"...","confidence":"high"},...}`;

const WHEEL_INSIGHT_PROMPT = `你是一个生命导师。根据用户7个生命维度的评分，为每个维度生成深度洞察。
返回JSON，键名为7个维度名：
{"学习成长":{"insight":"2-3句话","questions":["问题1","问题2","问题3"],"action":"具体行动"},...,"monthlyFocus":{"domain":"推荐维度","reason":"理由","steps":["第1周做X","第2-3周做Y","第4周回顾Z"]}}
只返回JSON。`;

const DAILY_QUESTION_PROMPT = `你是一个深度思考引导师。根据用户生命之轮中最低分的维度，生成一个当日思考问题。简短有力，一句话。
只返回JSON：{"question":"今日一问的问题内容","domain":"对应的生命维度"}`;

const PARSE_TODO_PROMPT = `你是一个任务解析器。把用户的自然语言转化为结构化任务JSON。返回格式：
{"text":"任务名称","priority":"normal","dueDate":"2024-01-01或null","dueTime":"15:00或null","tags":[],"subTasks":[{"text":"子任务1"}],"recur":"none","recurDays":[],"reminderMinutes":0,"note":""}
只返回JSON。`;

// ─── Main Handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { messages, mode, scores: inputScores, existingTodos, memoryContext, patterns, userAiConfig, modelProfileId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Resolve model config from DB or request
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    // Extract user ID from JWT if available
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ") && authHeader.length > 50) {
      try {
        const token = authHeader.split(" ")[1];
        const payload = JSON.parse(atob(token.split(".")[1]));
        userId = payload.sub || null;
      } catch { /* not a user JWT */ }
    }

    // Try to get model config from DB profile, fall back to legacy userAiConfig
    let modelConfig: ModelConfig | null = null;
    if (modelProfileId && userId) {
      modelConfig = await resolveModelConfig(supabaseUrl, serviceKey, userId, modelProfileId, "chat");
    } else if (userAiConfig?.base_url && userAiConfig?.api_key) {
      modelConfig = { baseUrl: userAiConfig.base_url, model: userAiConfig.model || "", apiKey: userAiConfig.api_key };
    }

    // Determine which default model to use based on mode
    const cheapModes = ["extract", "parse-todo", "voice-correct", "daily-question"];
    const defaultModel = cheapModes.includes(mode) ? resolveModel("cheap") : resolveModel("chat");

    // ─── Mode routing ───
    if (mode === "extract") {
      const userTexts = messages.map((m: any) => `[${m.role === 'user' ? '用户' : '罗盘'}]: ${m.content}`).join("\n");
      const today = new Date().toISOString().split("T")[0];
      const todosContext = existingTodos?.length > 0
        ? existingTodos.map((t: any) => `[${t.id}] ${t.text} (${t.status}, ${t.priority})`).join("\n")
        : "（暂无待办）";
      const prompt = EXTRACT_PROMPT.replace("{TODAY}", today).replace("{EXISTING_TODOS}", todosContext);
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("extract"), prompt, userTexts);
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (mode === "wheel-eval") {
      const userTexts = messages.filter((m: any) => m.role === "user").map((m: any) => m.content).join("\n");
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("extract"), WHEEL_EVAL_PROMPT, userTexts || "用户最近没有写日记。");
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (mode === "wheel-inference") {
      const userTexts = messages.filter((m: any) => m.role === "user").map((m: any) => m.content).join("\n");
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("extract"), WHEEL_INFER_PROMPT, userTexts || "用户最近没有写日记。");
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (mode === "wheel-insight") {
      const scoresText = inputScores
        ? Object.entries(inputScores).map(([k, v]) => `${k}: ${v}分`).join("\n")
        : "所有维度默认5分";
      const userTexts = messages?.filter((m: any) => m.role === "user").map((m: any) => m.content).join("\n") || "";
      const prompt = `用户的7维度评分：\n${scoresText}\n\n用户近期对话摘要：\n${userTexts || "暂无对话记录"}`;
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("extract"), WHEEL_INSIGHT_PROMPT, prompt);
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (mode === "daily-question") {
      const scoresText = inputScores
        ? Object.entries(inputScores).map(([k, v]) => `${k}: ${v}分`).join("\n")
        : "所有维度默认5分";
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("cheap"), DAILY_QUESTION_PROMPT, `用户的生命之轮评分：\n${scoresText}`);
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (mode === "parse-todo") {
      const userText = messages[messages.length - 1]?.content || "";
      const today = new Date().toISOString().split("T")[0];
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("cheap"), PARSE_TODO_PROMPT + `\n当前日期：${today}`, userText);
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (mode === "voice-correct") {
      const rawText = messages[messages.length - 1]?.content || "";
      const voiceCorrectPrompt = `你是一个语音识别纠错助手。修正语音识别错误，保持原意。
返回JSON：{"corrected":"修正后的文字","changes":[{"from":"原文片段","to":"修正后片段"}]}
如果没有修改，changes返回空数组。只返回JSON。`;
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("cheap"), voiceCorrectPrompt, rawText);
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (mode === "time-analysis") {
      const userText = messages[messages.length - 1]?.content || "";
      const timeAnalysisPrompt = `你是一个时间管理专家。根据用户的时间分布数据，给出分析和建议。
返回JSON：{"summary":"整体评价","insights":[{"icon":"⚡","title":"标题","detail":"分析"}],"suggestions":[{"action":"建议","reason":"理由"}],"encouragement":"鼓励的话"}
只返回JSON。`;
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("extract"), timeAnalysisPrompt, userText);
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (mode === "time-extract") {
      const userText = messages.map((m: any) => `[${m.role === 'user' ? '用户' : '罗盘'}]: ${m.content}`).join("\n");
      const today = new Date().toISOString().split("T")[0];
      const timeExtractPrompt = `你是时间记录助手。从日记/对话中提取时间块。当前日期：${today}
返回JSON：{"timeBlocks":[{"activity":"活动名","category":"分类","startTime":"HH:mm","endTime":"HH:mm","durationMinutes":180,"note":""}],"totalTrackedMinutes":720,"gaps":["未记录时间段"],"summary":"一句话总结"}
分类：工作、学习、生活、运动、社交、娱乐、休息、通勤、其他。只返回JSON。`;
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("extract"), timeExtractPrompt, userText);
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (mode === "decompose") {
      const taskText = messages[messages.length - 1]?.content || "";
      if (!taskText.trim()) {
        return new Response(JSON.stringify({ subTasks: [], error: "任务内容为空" }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      const DECOMPOSE_PROMPT = `你是一个任务拆解专家。将任务拆解为3-5个具体可执行的子步骤。
返回格式：{"subTasks": [{"text": "..."}, ...]}
只返回JSON。`;
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("extract"), DECOMPOSE_PROMPT, taskText);
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (mode === "brain-dump") {
      const userText = messages[messages.length - 1]?.content || "";
      const brainDumpPrompt = `你是任务整理助手。把乱序想法整理成待办任务列表。
只返回JSON：{"todos":[{"text":"...","priority":"high","estimatedMinutes":15,"tags":["工作"]}],"summary":"..."}`;
      const parsed = await llmJson(modelConfig, LOVABLE_API_KEY, resolveModel("extract"), brainDumpPrompt, userText);
      return new Response(JSON.stringify(parsed), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ─── Chat mode: streaming ───
    let systemContent = SYSTEM_PROMPT;

    if (memoryContext) {
      systemContent += `\n\n【你对用户近两周的了解（跨日记忆）】\n${memoryContext}\n`;
      systemContent += `当对话内容和过去记录有关联时，像真正认识这个人的朋友一样自然提及。`;
      if (memoryContext.includes('精力记录')) {
        systemContent += `\n\n【精力感知任务推荐】
当用户记录精力状态时，根据精力水平推荐适合的任务类型：
- 高精力 → 建议深度工作
- 中精力 → 建议创意型任务
- 低精力 → 建议轻量任务`;
      }
    }
    if (patterns) {
      systemContent += `\n\n【观察到的情绪模式】\n${patterns}\n适时温和地指出这些模式。`;
    }

    if (mode === "weekly-review") {
      systemContent += `\n\n【本次任务：周复盘信】
请以"一封来自罗盘的周信"形式回复。像写信一样自然地写。包含本周观察、一个模式、一个温和的提醒。控制在200字内。`;
    } else if (mode === "monthly-review") {
      systemContent += `\n\n【本次任务：月度回顾】
请以"月度回信"形式回复。像老朋友写信，包含整体感受、一个关键洞察、下个月的一个建议。控制在300字内。`;
    }

    // Get the chat model - prefer profile model, then default
    const chatModel = modelConfig?.model || resolveModel("chat");
    const response = await llmStream(modelConfig, LOVABLE_API_KEY, chatModel, systemContent, messages);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "请求频率过高，请稍后再试" }),
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "额度不足，请充值" }),
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI 服务暂时不可用" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...getCorsHeaders(req), "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
