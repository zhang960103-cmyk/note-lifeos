import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type Language = "zh" | "en" | "ar" | "ja" | "ko" | "fr" | "es" | "de" | "ru" | "pt";

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LANGUAGES: { key: Language; label: string; flag: string }[] = [
  { key: "zh", label: "中文", flag: "🇨🇳" },
  { key: "en", label: "English", flag: "🇺🇸" },
  { key: "ar", label: "العربية", flag: "🇸🇦" },
  { key: "ja", label: "日本語", flag: "🇯🇵" },
  { key: "ko", label: "한국어", flag: "🇰🇷" },
  { key: "fr", label: "Français", flag: "🇫🇷" },
  { key: "es", label: "Español", flag: "🇪🇸" },
  { key: "de", label: "Deutsch", flag: "🇩🇪" },
  { key: "ru", label: "Русский", flag: "🇷🇺" },
  { key: "pt", label: "Português", flag: "🇧🇷" },
];

// Only zh and en are fully maintained; other languages fall back to en then zh
const zh: Record<string, string> = {
  // Auth
  "app.name": "罗盘 · Life OS",
  "app.tagline": "你的私人生命导师",
  "auth.email": "邮箱",
  "auth.phone": "手机",
  "auth.email.placeholder": "邮箱地址",
  "auth.password.placeholder": "密码（至少6位）",
  "auth.login": "登录",
  "auth.signup": "注册",
  "auth.or": "或",
  "auth.google": "使用 Google 登录",
  "auth.no_account": "没有账号？注册",
  "auth.has_account": "已有账号？登录",
  "auth.forgot": "忘记密码？",
  "auth.back": "返回登录",
  "auth.forgot.desc": "输入注册邮箱，我们将发送重置链接",
  "auth.forgot.send": "发送重置链接",
  "auth.forgot.sent": "重置邮件已发送",
  "auth.forgot.check": "请检查收件箱",
  "auth.phone.placeholder": "手机号（含国际区号）",
  "auth.phone.hint": "请输入完整号码，如 +8613812345678",
  "auth.phone.send_otp": "发送验证码",
  "auth.phone.otp_sent": "验证码已发送至",
  "auth.phone.otp_placeholder": "输入6位验证码",
  "auth.phone.verify": "验证并登录",
  "auth.phone.resend": "重新发送",
  "auth.error.default": "操作失败",
  "auth.error.send_fail": "发送失败",
  "auth.error.otp_fail": "发送验证码失败",
  "auth.error.verify_fail": "验证失败",
  "auth.confirm_logout": "确定要退出登录吗？",

  // Tab bar
  "tab.today": "今天",
  "tab.todo": "待办",
  "tab.compass": "罗盘",
  "tab.wealth": "财富",

  // Settings
  "settings.title": "设置",
  "settings.language": "语言",
  "settings.account": "账号",
  "settings.logged_in": "已登录",
  "settings.not_logged_in": "未登录",
  "settings.logout": "退出登录",
  "settings.appearance": "外观",
  "settings.mode": "显示模式",
  "settings.mode.dark": "深色",
  "settings.mode.light": "浅色",
  "settings.accent": "主题色",
  "settings.more": "更多",
  "settings.guide": "使用指南",
  "settings.version": "版本",
  "settings.app_desc": "你的 AI 人生操作系统",
  "settings.export": "导出数据",

  // HomePage
  "home.greeting.night_late": "夜深了，还在思考什么？",
  "home.greeting.morning_early": "早安，新的一天开始了",
  "home.greeting.morning": "上午好，今天有什么计划？",
  "home.greeting.noon": "中午好，休息一下",
  "home.greeting.afternoon": "下午好，精力如何？",
  "home.greeting.evening": "晚上好，今天过得怎么样？",
  "home.greeting.night": "夜深了，今天有什么收获？",
  "home.greeting.yesterday_low": "昨天有点难熬，今天怎么样？",
  "home.greeting.streak": "我注意到你已经坚持了 {days} 天了",
  "home.greeting.monday": "新的一周。有什么想带着走的吗？",
  "home.input.placeholder": "说点什么...",
  "home.energy.high": "高",
  "home.energy.medium": "中",
  "home.energy.low": "低",
  "home.energy.title": "记录精力",
  "home.braindump.title": "🧠 脑清空",
  "home.braindump.desc": "随便倒，罗盘会自动整理成待办、记录时间和财务",
  "home.braindump.placeholder": "把脑子里所有想法随便倒出来...",
  "home.braindump.send": "📤 发给罗盘整理",
  "home.voice.title": "语音输入",
  "home.finance.title": "记账",
  "home.finance.income": "收入",
  "home.finance.expense": "支出",
  "home.finance.net": "净值",
  "home.finance.placeholder": "随便说，如：今天收了600学费，买书花了89...",
  "home.finance.submit": "AI 智能记账",
  "home.focus.title": "选择聚焦任务",
  "home.focus.now": "⚡ 现在：",
  "home.focus.none": "· 无聚焦任务",
  "home.focus.empty": "暂无待办任务",
  "home.tag_hint": "AI 自动提取",
  "home.recorded": "已记录 ✓",
  "home.mood.happy": "开心",
  "home.mood.calm": "平静",
  "home.mood.irritated": "烦躁",
  "home.mood.down": "低落",
  "home.mood.anxious": "焦虑",
  "home.mood.excited": "兴奋",
  "home.sunset.completed": "🌅 今天完成了 {count} 件事。写下今天的感受？",
  "home.sunset.empty": "🌅 快到今天结束了。有什么想记录的吗？",
  "home.weekly_letter": "📬 你的周报已就绪",
  "home.weekly_letter.open": "打开",
  "home.go_deeper": "↓ 深探",
  "home.low_energy_alert": "你已连续 {days} 天低能量，需要聊聊吗？",
  "home.daily_question": "每日一问 · {domain}",

  // TodoPage
  "todo.smart": "智能",
  "todo.matrix": "四象限",
  "todo.habits": "习惯",
  "todo.templates": "模板",
  "todo.column.todo": "待办",
  "todo.column.doing": "进行中",
  "todo.column.done": "已完成",
  "todo.priority.urgent": "紧急",
  "todo.priority.high": "重要",
  "todo.priority.normal": "普通",
  "todo.priority.low": "可选",
  "todo.add.placeholder": "添加新任务...",
  "todo.pomodoro": "🍅 番茄钟",
  "todo.time_stats": "⏱ 时间统计",
  "todo.habit.create": "创建习惯",
  "todo.habit.name": "习惯名称",
  "todo.template.workday": "工作日",
  "todo.template.restday": "休息日",
  "todo.template.sprint": "冲刺",
  "todo.template.apply": "套用",

  // WealthPage
  "wealth.title": "财富",
  "wealth.week": "本周",
  "wealth.month": "本月",
  "wealth.all": "全部",
  "wealth.income": "收入",
  "wealth.expense": "支出",
  "wealth.net": "净值",
  "wealth.category": "分类",
  "wealth.trend": "趋势",
  "wealth.records": "记录",
  "wealth.no_records": "暂无记录",
  "wealth.tips": "理财建议",

  // HistoryPage
  "history.title": "历史",
  "history.heatmap": "活动热力图",
  "history.no_entries": "暂无记录",
  "history.delete_confirm": "确定删除？",

  // WheelPage
  "wheel.title": "人生罗盘",
  "wheel.save": "保存评分",
  "wheel.ai_infer": "AI 推断",
  "wheel.ai_insights": "AI 洞察",
  "wheel.trend": "趋势",
  "wheel.history": "历史记录",

  // InsightsPage
  "insights.title": "洞察",
  "insights.patterns": "情绪模式",
  "insights.insights": "AI 建议",
  "insights.search": "搜索...",
  "insights.bookmark": "收藏",
  "insights.ask_compass": "问问罗盘",
  "insights.pattern_count": "出现了 {count} 次（最近 30 天）",

  // TimeStatsPage
  "timestats.title": "时间统计",
  "timestats.disc": "时间圆盘",
  "timestats.week_view": "周视图",
  "timestats.search": "搜索活动...",
  "timestats.ai_analysis": "AI 分析",

  // Common
  "common.save": "保存",
  "common.cancel": "取消",
  "common.delete": "删除",
  "common.edit": "编辑",
  "common.confirm": "确认",
  "common.loading": "加载中...",
  "common.back": "返回",
};

const en: Record<string, string> = {
  "app.name": "Compass · Life OS",
  "app.tagline": "Your Personal Life Mentor",
  "auth.email": "Email",
  "auth.phone": "Phone",
  "auth.email.placeholder": "Email address",
  "auth.password.placeholder": "Password (min 6 chars)",
  "auth.login": "Sign In",
  "auth.signup": "Sign Up",
  "auth.or": "or",
  "auth.google": "Sign in with Google",
  "auth.no_account": "No account? Sign up",
  "auth.has_account": "Have an account? Sign in",
  "auth.forgot": "Forgot password?",
  "auth.back": "Back to login",
  "auth.forgot.desc": "Enter your email and we'll send a reset link",
  "auth.forgot.send": "Send Reset Link",
  "auth.forgot.sent": "Reset email sent",
  "auth.forgot.check": "Please check your inbox",
  "auth.phone.placeholder": "Phone number (with country code)",
  "auth.phone.hint": "Enter full number, e.g. +14155551234",
  "auth.phone.send_otp": "Send Code",
  "auth.phone.otp_sent": "Code sent to",
  "auth.phone.otp_placeholder": "Enter 6-digit code",
  "auth.phone.verify": "Verify & Sign In",
  "auth.phone.resend": "Resend",
  "auth.error.default": "Operation failed",
  "auth.error.send_fail": "Failed to send",
  "auth.error.otp_fail": "Failed to send code",
  "auth.error.verify_fail": "Verification failed",
  "auth.confirm_logout": "Are you sure you want to sign out?",

  "tab.today": "Today",
  "tab.todo": "Todos",
  "tab.compass": "Compass",
  "tab.wealth": "Wealth",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.account": "Account",
  "settings.logged_in": "Logged in",
  "settings.not_logged_in": "Not logged in",
  "settings.logout": "Sign Out",
  "settings.appearance": "Appearance",
  "settings.mode": "Display Mode",
  "settings.mode.dark": "Dark",
  "settings.mode.light": "Light",
  "settings.accent": "Accent Color",
  "settings.more": "More",
  "settings.guide": "User Guide",
  "settings.version": "Version",
  "settings.app_desc": "Your AI Life Operating System",
  "settings.export": "Export Data",

  "home.greeting.night_late": "Late night — what's on your mind?",
  "home.greeting.morning_early": "Good morning, a new day begins",
  "home.greeting.morning": "Good morning, any plans today?",
  "home.greeting.noon": "Good afternoon, take a break",
  "home.greeting.afternoon": "Good afternoon, how's your energy?",
  "home.greeting.evening": "Good evening, how was your day?",
  "home.greeting.night": "Late night — any takeaways from today?",
  "home.greeting.yesterday_low": "Yesterday was tough. How are you today?",
  "home.greeting.streak": "I noticed you've kept going for {days} days",
  "home.greeting.monday": "New week. Anything you want to carry forward?",
  "home.input.placeholder": "Say something...",
  "home.energy.high": "High",
  "home.energy.medium": "Medium",
  "home.energy.low": "Low",
  "home.energy.title": "Log Energy",
  "home.braindump.title": "🧠 Brain Dump",
  "home.braindump.desc": "Dump everything — Compass will sort it into tasks, time logs, and finances",
  "home.braindump.placeholder": "Dump all your thoughts here...",
  "home.braindump.send": "📤 Send to Compass",
  "home.voice.title": "Voice Input",
  "home.finance.title": "Finance",
  "home.finance.income": "Income",
  "home.finance.expense": "Expense",
  "home.finance.net": "Net",
  "home.finance.placeholder": "Just say it, e.g.: earned 600 from tutoring, spent 89 on books...",
  "home.finance.submit": "AI Smart Bookkeeping",
  "home.focus.title": "Choose Focus Task",
  "home.focus.now": "⚡ Now: ",
  "home.focus.none": "· No focus task",
  "home.focus.empty": "No tasks yet",
  "home.tag_hint": "AI auto-extracted",
  "home.recorded": "Recorded ✓",
  "home.mood.happy": "Happy",
  "home.mood.calm": "Calm",
  "home.mood.irritated": "Irritated",
  "home.mood.down": "Down",
  "home.mood.anxious": "Anxious",
  "home.mood.excited": "Excited",
  "home.sunset.completed": "🌅 Completed {count} tasks today. Write down how you feel?",
  "home.sunset.empty": "🌅 Day is almost over. Anything to record?",
  "home.weekly_letter": "📬 Your weekly review is ready",
  "home.weekly_letter.open": "Open",
  "home.go_deeper": "↓ Go deeper",
  "home.low_energy_alert": "Low energy for {days} days straight. Want to talk about it?",
  "home.daily_question": "Daily Question · {domain}",

  "todo.smart": "Smart",
  "todo.matrix": "Matrix",
  "todo.habits": "Habits",
  "todo.templates": "Templates",
  "todo.column.todo": "To Do",
  "todo.column.doing": "In Progress",
  "todo.column.done": "Done",
  "todo.priority.urgent": "Urgent",
  "todo.priority.high": "Important",
  "todo.priority.normal": "Normal",
  "todo.priority.low": "Optional",
  "todo.add.placeholder": "Add new task...",
  "todo.pomodoro": "🍅 Pomodoro",
  "todo.time_stats": "⏱ Time Stats",
  "todo.habit.create": "Create Habit",
  "todo.habit.name": "Habit name",
  "todo.template.workday": "Workday",
  "todo.template.restday": "Rest Day",
  "todo.template.sprint": "Sprint",
  "todo.template.apply": "Apply",

  "wealth.title": "Wealth",
  "wealth.week": "Week",
  "wealth.month": "Month",
  "wealth.all": "All",
  "wealth.income": "Income",
  "wealth.expense": "Expense",
  "wealth.net": "Net",
  "wealth.category": "Categories",
  "wealth.trend": "Trend",
  "wealth.records": "Records",
  "wealth.no_records": "No records yet",
  "wealth.tips": "Financial Tips",

  "history.title": "History",
  "history.heatmap": "Activity Heatmap",
  "history.no_entries": "No entries yet",
  "history.delete_confirm": "Confirm delete?",

  "wheel.title": "Life Compass",
  "wheel.save": "Save Scores",
  "wheel.ai_infer": "AI Infer",
  "wheel.ai_insights": "AI Insights",
  "wheel.trend": "Trends",
  "wheel.history": "History",

  "insights.title": "Insights",
  "insights.patterns": "Emotion Patterns",
  "insights.insights": "AI Suggestions",
  "insights.search": "Search...",
  "insights.bookmark": "Bookmark",
  "insights.ask_compass": "Ask Compass",
  "insights.pattern_count": "Appeared {count} times (last 30 days)",

  "timestats.title": "Time Stats",
  "timestats.disc": "Time Disc",
  "timestats.week_view": "Week View",
  "timestats.search": "Search activities...",
  "timestats.ai_analysis": "AI Analysis",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.confirm": "Confirm",
  "common.loading": "Loading...",
  "common.back": "Back",
};

const ar: Record<string, string> = {
  "app.name": "البوصلة · Life OS",
  "app.tagline": "مرشدك الشخصي في الحياة",
  "auth.email": "البريد",
  "auth.phone": "الهاتف",
  "auth.email.placeholder": "عنوان البريد الإلكتروني",
  "auth.password.placeholder": "كلمة المرور (٦ أحرف على الأقل)",
  "auth.login": "تسجيل الدخول",
  "auth.signup": "إنشاء حساب",
  "auth.no_account": "ليس لديك حساب؟ سجّل",
  "auth.has_account": "لديك حساب؟ سجّل الدخول",
  "auth.forgot": "نسيت كلمة المرور؟",
  "auth.back": "العودة لتسجيل الدخول",
  "auth.forgot.desc": "أدخل بريدك وسنرسل رابط إعادة التعيين",
  "auth.forgot.send": "إرسال رابط إعادة التعيين",
  "auth.forgot.sent": "تم إرسال بريد إعادة التعيين",
  "auth.forgot.check": "يرجى التحقق من صندوق الوارد",
  "auth.phone.placeholder": "رقم الهاتف (مع رمز الدولة)",
  "auth.phone.hint": "أدخل الرقم الكامل، مثل 966512345678+",
  "auth.phone.send_otp": "إرسال الرمز",
  "auth.phone.otp_sent": "تم إرسال الرمز إلى",
  "auth.phone.otp_placeholder": "أدخل الرمز المكون من ٦ أرقام",
  "auth.phone.verify": "تحقق وسجّل الدخول",
  "auth.phone.resend": "إعادة الإرسال",
  "auth.error.default": "فشلت العملية",
  "auth.confirm_logout": "هل تريد تسجيل الخروج؟",
  "tab.today": "اليوم",
  "tab.todo": "المهام",
  "tab.compass": "البوصلة",
  "tab.wealth": "الثروة",
  "settings.title": "الإعدادات",
  "settings.language": "اللغة",
  "settings.account": "الحساب",
  "settings.logout": "تسجيل الخروج",
  "settings.appearance": "المظهر",
  "settings.mode": "وضع العرض",
  "settings.mode.dark": "داكن",
  "settings.mode.light": "فاتح",
  "settings.accent": "لون التمييز",
  "settings.more": "المزيد",
  "settings.guide": "دليل الاستخدام",
  "settings.version": "الإصدار",
  "home.input.placeholder": "قل شيئاً...",
  "home.energy.high": "عالية",
  "home.energy.medium": "متوسطة",
  "home.energy.low": "منخفضة",
};

// For other languages, we provide minimal overrides; they fall back to en
const ja: Record<string, string> = {
  "app.name": "羅針盤 · Life OS",
  "app.tagline": "あなたのライフメンター",
  "tab.today": "今日",
  "tab.todo": "タスク",
  "tab.compass": "羅針盤",
  "tab.wealth": "資産",
  "settings.title": "設定",
  "settings.logout": "ログアウト",
  "home.input.placeholder": "何か言ってみて...",
  "auth.login": "ログイン",
  "auth.signup": "新規登録",
};

const ko: Record<string, string> = {
  "app.name": "나침반 · Life OS",
  "app.tagline": "당신의 인생 멘토",
  "tab.today": "오늘",
  "tab.todo": "할 일",
  "tab.compass": "나침반",
  "tab.wealth": "자산",
  "settings.title": "설정",
  "settings.logout": "로그아웃",
  "home.input.placeholder": "무언가 말해보세요...",
  "auth.login": "로그인",
  "auth.signup": "회원가입",
};

const fr: Record<string, string> = {
  "app.name": "Boussole · Life OS",
  "app.tagline": "Votre mentor de vie",
  "tab.today": "Aujourd'hui",
  "tab.todo": "Tâches",
  "tab.compass": "Boussole",
  "tab.wealth": "Finance",
  "settings.title": "Paramètres",
  "settings.logout": "Déconnexion",
  "home.input.placeholder": "Dites quelque chose...",
  "auth.login": "Connexion",
  "auth.signup": "Inscription",
};

const es: Record<string, string> = {
  "app.name": "Brújula · Life OS",
  "app.tagline": "Tu mentor de vida",
  "tab.today": "Hoy",
  "tab.todo": "Tareas",
  "tab.compass": "Brújula",
  "tab.wealth": "Finanzas",
  "settings.title": "Ajustes",
  "settings.logout": "Cerrar sesión",
  "home.input.placeholder": "Di algo...",
  "auth.login": "Iniciar sesión",
  "auth.signup": "Registrarse",
};

const de: Record<string, string> = {
  "app.name": "Kompass · Life OS",
  "app.tagline": "Dein Lebensmentor",
  "tab.today": "Heute",
  "tab.todo": "Aufgaben",
  "tab.compass": "Kompass",
  "tab.wealth": "Finanzen",
  "settings.title": "Einstellungen",
  "settings.logout": "Abmelden",
  "home.input.placeholder": "Sag etwas...",
  "auth.login": "Anmelden",
  "auth.signup": "Registrieren",
};

const ru: Record<string, string> = {
  "app.name": "Компас · Life OS",
  "app.tagline": "Ваш личный наставник",
  "tab.today": "Сегодня",
  "tab.todo": "Задачи",
  "tab.compass": "Компас",
  "tab.wealth": "Финансы",
  "settings.title": "Настройки",
  "settings.logout": "Выйти",
  "home.input.placeholder": "Скажите что-нибудь...",
  "auth.login": "Войти",
  "auth.signup": "Регистрация",
};

const pt: Record<string, string> = {
  "app.name": "Bússola · Life OS",
  "app.tagline": "Seu mentor de vida",
  "tab.today": "Hoje",
  "tab.todo": "Tarefas",
  "tab.compass": "Bússola",
  "tab.wealth": "Finanças",
  "settings.title": "Configurações",
  "settings.logout": "Sair",
  "home.input.placeholder": "Diga algo...",
  "auth.login": "Entrar",
  "auth.signup": "Cadastrar",
};

const translations: Record<Language, Record<string, string>> = {
  zh, en, ar, ja, ko, fr, es, de, ru, pt,
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() =>
    (localStorage.getItem("los-lang") as Language) || "zh"
  );

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem("los-lang", l);
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = l;
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = translations[lang]?.[key] || translations.en?.[key] || translations.zh?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [lang]);

  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
