import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// BUG-04：隐私政策此前完全硬编码中文，英文模式下用户看到的是一份自己读不懂的法律文本。
// 这是正式的隐私条款，逐句忠实翻译（不是意译/摘要），保留所有具体事实性承诺
// （服务器所在地、加密方式、AI供应商名称、30天删除期限等），避免翻译引入任何
// 法律含义上的偏差。翻译文本审阅时应对照原文逐条核对。
export default function PrivacyPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const sections = [
    { titleKey: "privacy.s1_title", bodyKey: "privacy.s1_body" },
    { titleKey: "privacy.s2_title", bodyKey: "privacy.s2_body" },
    { titleKey: "privacy.s3_title", bodyKey: "privacy.s3_body" },
    { titleKey: "privacy.s4_title", bodyKey: "privacy.s4_body" },
    { titleKey: "privacy.s5_title", bodyKey: "privacy.s5_body" },
    { titleKey: "privacy.s6_title", bodyKey: "privacy.s6_body" },
    { titleKey: "privacy.s7_title", bodyKey: "privacy.s7_body" },
  ];
  return (
    <div className="h-full overflow-y-auto max-w-[600px] mx-auto px-4 pb-8">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /></button>
        <h1 className="font-serif-sc text-base text-foreground">{t("privacy.title")}</h1>
      </div>
      <div className="space-y-4 text-sm text-foreground/80 leading-[1.8]">
        <p className="text-[10px] text-muted-foreground">{t("privacy.last_updated")}</p>
        {sections.map(s => (
          <section key={s.titleKey}>
            <h2 className="font-semibold text-foreground mb-1">{t(s.titleKey)}</h2>
            <p>{t(s.bodyKey)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
