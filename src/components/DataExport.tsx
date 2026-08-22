import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

// 备份文件的数据结构版本——独立于App显示版本号(2.2.0那种)，只在导入/导出
// 需要判断"这份JSON我认不认识"的时候用。只要以后新增字段用的是"多了就多了、
// 缺了就按默认值处理"的兼容写法，就不需要每次都升这个号；只有备份的整体
// 结构发生不兼容变化时才升级，DataImport.tsx 会据此判断能不能安全导入。
const BACKUP_SCHEMA_VERSION = 2;

// 待办/日记/记账等核心数据已经在Supabase云端，走上面的entries/todos这些字段。
// 但预算、订阅提醒、借还记录、项目分组这几个模块目前设计上只存在浏览器
// localStorage里，从来没有同步到云端(见useLocalData.ts/useProjects.ts)——
// 之前的"全部数据备份"其实完全没包含这几类，只要清了浏览器数据或换个设备，
// 这些内容就随着"没被截图看到过的隐藏配置"一起丢了，用户还以为自己有备份。
// 这里把它们也扫进备份里。
function collectLocalExtras(userId: string): Record<string, string> {
  const extras: Record<string, string> = {};
  const prefixes = [`budgets_${userId}`, `subscriptions_${userId}`, `ious_${userId}`, `projects_${userId}`];
  try {
    for (const key of Object.keys(localStorage)) {
      if (prefixes.includes(key)) {
        const v = localStorage.getItem(key);
        if (v != null) extras[key] = v;
      }
    }
  } catch (e) {
    console.warn("[DataExport] 读取本地扩展数据失败（不影响云端数据导出）:", e);
  }
  return extras;
}

export default function DataExport() {
  const { entries, allTodos, financeEntries, habits, wheelScores, energyLogs } = useLifeOs();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  const exportJSON = () => {
    setExporting(true);
    try {
      const data = {
        exportDate: new Date().toISOString(),
        schemaVersion: BACKUP_SCHEMA_VERSION,
        appVersion: "2.2.0",
        entries,
        todos: allTodos,
        financeEntries,
        habits,
        wheelScores,
        energyLogs,
        // 预算/订阅/借还/项目——只在本地存在，第一次被纳入完整备份
        localExtras: user ? collectLocalExtras(user.id) : {},
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lifeos-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      // 之前这里没有catch，Blob/下载被浏览器拒绝(存储空间不足、隐私模式限制等)
      // 时会是完全静默的失败——按钮转完圈之后什么都没发生，用户不知道要不要重试。
      console.error("[DataExport] JSON导出失败:", e);
      alert(`${t("data_export.fail_prefix")}${e?.message || t("data_export.unknown_error")}\n\n${t("data_export.fail_hint")}`);
    } finally {
      setExporting(false);
    }
  };

  const exportCSV = () => {
    setExporting(true);
    try {
      // 导出待办为 CSV
      const headers = [
        t("data_export.csv_header.date"),
        t("data_export.csv_header.task"),
        t("data_export.csv_header.status"),
        t("data_export.csv_header.priority"),
        t("data_export.csv_header.tags"),
        t("data_export.csv_header.note"),
      ];
      const rows = allTodos.map(t => [
        t.sourceDate || t.createdAt.split("T")[0],
        `"${t.text.replace(/"/g, '""')}"`,
        t.status,
        t.priority,
        t.tags.join(";"),
        `"${(t.note || "").replace(/"/g, '""')}"`,
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lifeos-todos-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("[DataExport] CSV导出失败:", e);
      alert(`${t("data_export.fail_prefix")}${e?.message || t("data_export.unknown_error")}\n\n${t("data_export.fail_hint")}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={exportJSON}
        disabled={exporting}
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface-3 transition text-left"
      >
        <Download size={14} className="text-muted-foreground" />
        <span className="text-xs text-foreground flex-1">{t("settings.export_json") || "导出全部数据 (JSON)"}</span>
        {exporting && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      </button>
      <button
        onClick={exportCSV}
        disabled={exporting}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-3 transition text-left"
      >
        <Download size={14} className="text-muted-foreground" />
        <span className="text-xs text-foreground flex-1">{t("settings.export_csv") || "导出待办 (CSV)"}</span>
      </button>
    </div>
  );
}
