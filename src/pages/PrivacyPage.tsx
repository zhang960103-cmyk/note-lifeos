import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div className="h-full overflow-y-auto max-w-[600px] mx-auto px-4 pb-8">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /></button>
        <h1 className="font-serif-sc text-base text-foreground">隐私政策</h1>
      </div>
      <div className="space-y-4 text-sm text-foreground/80 leading-[1.8]">
        <p className="text-[10px] text-muted-foreground">最后更新：2025年5月</p>
        <section><h2 className="font-semibold text-foreground mb-1">1. 我们收集什么</h2>
          <p>我们收集你在应用中主动输入的内容，包括日记文字、情绪记录、待办事项、财务记录。我们不收集你的通讯录、位置信息或设备标识符。</p></section>
        <section><h2 className="font-semibold text-foreground mb-1">2. 数据存储</h2>
          <p>你的数据存储在 Supabase 提供的数据库中，服务器位于美国。数据库连接使用 TLS 加密传输。数据库内容目前以明文存储，我们计划在后续版本中引入客户端加密。</p></section>
        <section><h2 className="font-semibold text-foreground mb-1">3. AI 处理</h2>
          <p>你与导师的对话会发送给 AI 模型提供商（包括 Anthropic、OpenAI 等）进行处理。这些提供商有各自的隐私政策。我们不会主动使用你的对话内容来训练模型，但无法保证所有第三方提供商的行为。如果你有敏感内容，建议避免在应用中输入。</p></section>
        <section><h2 className="font-semibold text-foreground mb-1">4. 数据共享</h2>
          <p>我们不会出售、出租或向广告商共享你的个人数据。你的数据仅用于向你提供应用功能。</p></section>
        <section><h2 className="font-semibold text-foreground mb-1">5. 你的权利</h2>
          <p>你可以在设置页面导出或删除你的全部数据。删除账号后，我们会在 30 天内从数据库中永久移除你的所有记录。</p></section>
        <section><h2 className="font-semibold text-foreground mb-1">6. 访客模式</h2>
          <p>访客模式的数据仅存储在本地浏览器中。清除浏览器缓存、更换设备或浏览器将导致数据永久丢失。我们强烈建议注册账号以保护你的数据。</p></section>
        <section><h2 className="font-semibold text-foreground mb-1">7. 联系方式</h2>
          <p>如有隐私相关问题，请通过应用内设置页面联系我们。</p></section>
      </div>
    </div>
  );
}
