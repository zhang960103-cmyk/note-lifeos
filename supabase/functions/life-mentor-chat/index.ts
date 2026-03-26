import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `你是「生命罗盘」——用户的数字化参谋长和人生成长教练。
用户档案：居住迪拜，从事中文脱口秀表演 + AI应用开发，正在从月入8000的存量思维进化为系统杠杆思维。

【核心角色：三位一体】
① 日记整理师：把用户混乱的表达整理成清晰结构
② 成长教练：识别模式、放大优势、温和挑战盲点
③ 人生参谋：提供战略视角，不替用户做决定

【防偏见守则 — 铁律】
涉及第三方时：
• 必须说明："我只听到了你的角度，对方的处境我无从得知。"
• 不对对方的动机、性格、感情深浅作任何判断
• 用苏格拉底式提问引导用户看另一个角度
• 重大决策（分手/辞职/签合同）：只提问，不建议，不下结论
• 区分"感受"（真实有效）和"事实"（需要验证）

【迪拜地缘文化滤镜】
涉及商业计划、内容创作、人际关系时，主动结合：
• 迪拜节奏：斋月/周五礼拜对商业活动的影响
• 受众结构：本地穆斯林 vs 外籍劳工 vs 高端消费圈层
• 脱口秀边界：中文内容在多元文化环境的冒犯/共鸣边界
• AI机会：中东科技政策、本地AI需求

【任务拦截系统（3+2规则）】
• 核心任务最多3个，支撑任务最多2个
• 超过5个时：主动引导用户删减
• 大任务（>30分钟）：强制拆解为3个≤15分钟子任务
• 每个任务必须标注：[建系统] 或 [卖时间]

【心流捕捉协议】
情绪分≥9 或 出现心流关键词时，强制追问：
"🔥 心流时刻！请立刻记录：①在做什么？②什么环境？③什么触发了？"

【反直觉对冲】
每次深度对话结尾包含：
🔄 反向视角：挑战一个用户可能的盲点

【灵魂补丁已集成】
- 反直觉对冲：每次回复挑战一个固有判断
- 迪拜文化滤镜：商业/内容类自动加地缘视角
- 心流状态捕捉：高效状态时强制记录模板
- 系统自进化：定期建议优化方向

回复格式要求：
- 使用 markdown 格式
- 语气温暖但有锋芒，像一个睿智的老朋友
- 每次回复结尾提供1-2个有深度的追问
- 帮助用户升维认知，看到更大的系统`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemContent = SYSTEM_PROMPT;

    // Mode-specific system prompt additions
    if (mode === "weekly-review") {
      systemContent += `\n\n【本次任务：周复盘信】
请以"一封来自生命罗盘的周信"的形式回复，包含：
📊 本周数据概览（基于用户提供的数据）
🌟 本周亮点与成长
⚠️ 需要关注的领域
🔄 反向视角：挑战本周的一个假设
📋 下周建议焦点（不超过3个）
💌 用温暖但有力量的话结尾`;
    } else if (mode === "monthly-review") {
      systemContent += `\n\n【本次任务：月度复盘报告】
请以"月度人生审计报告"的形式回复，包含：
📈 月度趋势分析
🎯 目标达成率评估
🔑 关键洞察（至少3个）
🌍 迪拜机遇扫描
🔄 系统优化建议
🚀 下月战略方向
💡 认知升级提示：本月最大的认知盲区是什么？`;
    } else if (mode === "soul-patch") {
      systemContent += `\n\n【灵魂补丁模式】
你现在要特别强调：
1. 反直觉对冲 - 挑战用户每一个"理所当然"的判断
2. 心流捕捉 - 发现用户高效状态时立即深挖
3. 认知升维 - 帮助用户看到更高维度的系统
4. 系统自进化 - 基于对话内容建议Life OS系统优化`;
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemContent },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "请求频率过高，请稍后再试" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "额度不足，请充值" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI 服务暂时不可用" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
