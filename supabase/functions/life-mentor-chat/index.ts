import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `你是用户的私人生命导师，名字叫「罗盘」。你不是顾问，不是教练，不是分析师。你是一个真正了解他/她的老朋友，陪他/她想清楚自己的生活。

你的说话方式：
- 每次回复不超过3句话，绝对不超过80字
- 不使用任何格式：没有加粗、没有编号、没有小标题、没有分隔线
- 每次回复结尾只问一个问题，不多问
- 语气温和、直接、有时候带一点幽默，但不刻意
- 你会记住这段对话里用户说过的所有内容，回应时体现出你在认真听

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
- 不会用励志语录结尾`;

const EXTRACT_PROMPT = `你是一个JSON提取器。根据用户的对话内容，提取以下信息并返回JSON格式（不要返回其他内容）：
{
  "emotionTags": ["标签1", "标签2"],  // 情绪标签，如：焦虑、兴奋、疲惫、清晰、迷茫、感恩
  "topicTags": ["标签1", "标签2"],    // 主题标签，如：工作、关系、身体、创意、家庭、财务
  "todos": ["任务1", "任务2"],         // 从对话中识别的行动意图，转化为简短任务
  "emotionScore": 6                    // 情绪分值1-10，10最积极
}
只返回JSON，不要有其他文字。`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Extract mode: non-streaming, returns JSON metadata
    if (mode === "extract") {
      const userTexts = messages
        .filter((m: any) => m.role === "user")
        .map((m: any) => m.content)
        .join("\n");

      const extractResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: EXTRACT_PROMPT },
              { role: "user", content: userTexts },
            ],
          }),
        }
      );

      if (!extractResp.ok) {
        return new Response(
          JSON.stringify({ error: "提取失败" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const extractData = await extractResp.json();
      const raw = extractData.choices?.[0]?.message?.content || "{}";
      // Try to parse JSON from the response
      let parsed;
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        parsed = {};
      }

      return new Response(
        JSON.stringify(parsed),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chat mode: streaming
    let systemContent = SYSTEM_PROMPT;

    if (mode === "weekly-review") {
      systemContent += `\n\n【本次任务：周复盘信】
请以"一封来自罗盘的周信"形式回复。不要用格式标记，像写信一样自然地写。包含本周观察、一个你注意到的模式、一个温和的提醒。控制在200字内。`;
    } else if (mode === "monthly-review") {
      systemContent += `\n\n【本次任务：月度回顾】
请以"月度回信"形式回复。像老朋友写信，不用格式标记。包含这个月的整体感受、一个关键洞察、下个月的一个建议。控制在300字内。`;
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
