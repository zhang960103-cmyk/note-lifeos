import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { format, addDays, startOfWeek, parseISO, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Download } from "lucide-react";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 7:00–23:00
const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const { allTodos, entries, todayKey } = useLifeOs();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Build time blocks from todos with dueTime + timeBlock notes
  const timeBlocks = useMemo(() => {
    const blocks: Array<{
      dayIndex: number;
      startMin: number;
      endMin: number;
      label: string;
      status: string;
      color: string;
    }> = [];

    days.forEach((day, dayIndex) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const entry = entries.find(e => e.date === dateStr);

      // From todos with dueTime
      allTodos
        .filter(t => (t.sourceDate === dateStr || t.dueDate === dateStr) && t.dueTime)
        .forEach(t => {
          const startMin = parseTimeToMinutes(t.dueTime!);
          blocks.push({
            dayIndex,
            startMin,
            endMin: startMin + 60,
            label: t.text,
            status: t.status,
            color: t.status === "done" ? "bg-los-green/30 border-los-green/50"
              : t.priority === "urgent" ? "bg-destructive/20 border-destructive/40"
              : "bg-primary/20 border-primary/40",
          });
        });

      // From diary time blocks (⏱ format)
      if (entry) {
        entry.todos
          .filter(t => t.note?.includes("⏱"))
          .forEach(t => {
            const match = t.note?.match(/⏱ (\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
            if (match) {
              blocks.push({
                dayIndex,
                startMin: parseTimeToMinutes(match[1]),
                endMin: parseTimeToMinutes(match[2]),
                label: t.text,
                status: t.status,
                color: "bg-gold/20 border-gold/40",
              });
            }
          });
      }
    });

    return blocks;
  }, [days, allTodos, entries]);

  // Export as .ics
  const exportIcal = () => {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//罗盘 Life OS//ZH",
    ];
    allTodos
      .filter(t => t.dueDate && t.dueTime && t.status !== "dropped")
      .forEach(t => {
        const dt = `${t.dueDate!.replace(/-/g, "")}T${t.dueTime!.replace(":", "")}00`;
        lines.push("BEGIN:VEVENT");
        lines.push(`DTSTART:${dt}`);
        lines.push(`DTEND:${dt.slice(0, -2)}00`);
        lines.push(`SUMMARY:${t.text}`);
        lines.push(`STATUS:${t.status === "done" ? "COMPLETED" : "NEEDS-ACTION"}`);
        lines.push("END:VEVENT");
      });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lifeos-calendar.ics";
    a.click();
  };

  const cellH = 48; // px per hour
  const headerH = 56;

  return (
    <div className="flex flex-col h-full max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground p-1">
            <ChevronLeft size={18} />
          </button>
          <span className="font-serif-sc text-base">
            {format(weekStart, "M月d日")} – {format(addDays(weekStart, 6), "M月d日")}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setWeekOffset(0)}
            className="text-[10px] px-2 py-1 bg-muted text-muted-foreground rounded-lg hover:bg-accent">
            本周
          </button>
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
            <ChevronRight size={14} />
          </button>
          <button onClick={exportIcal}
            className="flex items-center gap-1 text-[10px] px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20">
            <Download size={11} /> 导出.ics
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-border flex-shrink-0" style={{ paddingLeft: 36 }}>
        {days.map((day, i) => {
          const isToday = isSameDay(day, new Date());
          return (
            <div key={i} className="flex-1 text-center py-2">
              <div className="text-[9px] text-muted-foreground">{DAY_LABELS[day.getDay()]}</div>
              <div className={`text-sm font-mono-jb mx-auto w-7 h-7 flex items-center justify-center rounded-full
                ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: HOURS.length * cellH }}>
          {/* Hour labels */}
          <div className="flex-shrink-0 w-9">
            {HOURS.map(h => (
              <div key={h} className="flex items-start justify-end pr-1"
                style={{ height: cellH, paddingTop: 2 }}>
                <span className="text-[8px] text-muted-foreground/60 font-mono-jb">{h}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1 relative">
            {/* Grid lines */}
            {HOURS.map(h => (
              <div key={h} className="absolute inset-x-0 border-t border-border/40"
                style={{ top: (h - 7) * cellH }} />
            ))}

            {/* Day columns */}
            {days.map((day, dayIndex) => {
              const isToday = isSameDay(day, new Date());
              const colBlocks = timeBlocks.filter(b => b.dayIndex === dayIndex);
              return (
                <div key={dayIndex}
                  className={`flex-1 relative border-l border-border/30 ${isToday ? "bg-primary/3" : ""}`}>
                  {colBlocks.map((block, bi) => {
                    const top = ((block.startMin / 60) - 7) * cellH;
                    const height = Math.max(((block.endMin - block.startMin) / 60) * cellH, 20);
                    return (
                      <div key={bi}
                        className={`absolute inset-x-0.5 rounded border text-[8px] px-1 overflow-hidden ${block.color}`}
                        style={{ top, height }}>
                        <span className="line-clamp-2 leading-[1.3] font-medium">{block.label}</span>
                      </div>
                    );
                  })}
                  {/* Current time line */}
                  {isToday && (() => {
                    const now = new Date();
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (nowMin < 7 * 60 || nowMin > 23 * 60) return null;
                    const top = ((nowMin / 60) - 7) * cellH;
                    return (
                      <div className="absolute inset-x-0 flex items-center" style={{ top }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                        <div className="flex-1 h-px bg-destructive" />
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="px-4 py-2 border-t border-border text-[9px] text-muted-foreground flex-shrink-0">
        💡 在主页说"明天下午3点开会"或给待办设置时间，会自动显示在这里。点「导出.ics」可导入到 Google/苹果日历。
      </div>
    </div>
  );
}
