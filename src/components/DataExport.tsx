import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DataExport() {
  const { entries, allTodos, financeEntries, habits, wheelScores, energyLogs } = useLifeOs();
  const { t } = useLanguage();
  const [exporting, setExporting] = useState(false);

  const exportJSON = () => {
    setExporting(true);
    try {
      const data = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        entries,
        todos: allTodos,
        financeEntries,
        habits,
        wheelScores,
        energyLogs,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lifeos-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const exportCSV = () => {
    setExporting(true);
    try {
      // 导出待办为 CSV
      const headers = ["日期", "任务", "状态", "优先级", "标签", "备注"];
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
