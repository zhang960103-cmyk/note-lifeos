import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useProjects, PROJECT_COLORS } from "@/hooks/useProjects";
import { format } from "date-fns";
import {
  ChevronLeft, Plus, Archive, Trash2, Check, X, Folder,
  CheckSquare, FileText, Target, Pencil
} from "lucide-react";
import type { Project } from "@/types/lifeOs";

const EMOJI_OPTIONS = ["🚀","💼","📚","🎯","💡","🏃","🌱","✍️","🎨","💰","🏋️","🧘","🌏","🔬","🎵","🏠","❤️","⭐"];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { allTodos, entries, updateTodo } = useLifeOs();
  const { activeProjects, archivedProjects, addProject, updateProject, archiveProject, deleteProject } = useProjects(user?.id);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🚀");
  const [newDesc, setNewDesc] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    const p = addProject(newName, newEmoji, newDesc);
    setNewName(""); setNewEmoji("🚀"); setNewDesc("");
    setShowCreate(false);
    setSelectedProject(p);
  };

  // Project-scoped data
  const projectTodos = useMemo(() => {
    if (!selectedProject) return [];
    return allTodos.filter(t => t.projectId === selectedProject.id);
  }, [allTodos, selectedProject]);

  const projectDiaryMentions = useMemo(() => {
    if (!selectedProject) return [];
    const name = selectedProject.name.toLowerCase();
    return entries.filter(e =>
      e.messages.some(m => m.content.toLowerCase().includes(name))
    ).slice(0, 10);
  }, [entries, selectedProject]);

  const doneTodos = projectTodos.filter(t => t.status === "done");
  const pendingTodos = projectTodos.filter(t => t.status !== "done" && t.status !== "dropped");
  const progress = projectTodos.length > 0 ? Math.round(doneTodos.length / projectTodos.length * 100) : 0;

  // Assign a todo to current project
  const assignTodo = useCallback((todoId: string, sourceDate: string) => {
    if (!selectedProject) return;
    updateTodo(sourceDate, todoId, { projectId: selectedProject.id } as any);
  }, [selectedProject, updateTodo]);

  const colors = selectedProject ? PROJECT_COLORS[selectedProject.color] : PROJECT_COLORS.gold;

  // ── Detail view ──
  if (selectedProject) {
    return (
      <div className="flex flex-col h-full max-w-[700px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-[52px] border-b border-border flex-shrink-0 bg-surface-1/90 backdrop-blur-sm">
          <button onClick={() => setSelectedProject(null)} className="touch-target text-muted-foreground hover:text-foreground rounded-xl" style={{transform:"scale(0.85)"}}>
            <ChevronLeft size={22} />
          </button>
          <span className="text-xl">{selectedProject.emoji}</span>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif-sc text-base text-foreground truncate">{selectedProject.name}</h1>
            {selectedProject.description && <p className="text-caption text-muted-foreground truncate">{selectedProject.description}</p>}
          </div>
          <button onClick={() => archiveProject(selectedProject.id)}
            className="touch-target text-muted-foreground hover:text-foreground rounded-xl" style={{transform:"scale(0.85)"}}>
            <Archive size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-3 space-y-4 pb-8">
          {/* Progress */}
          <div className={`rounded-xl p-4 border ${colors.bg} ${colors.border}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold ${colors.text}`}>{t("projects.progress_label")}</span>
              <span className={`text-sm font-mono-jb font-bold ${colors.text}`}>{progress}%</span>
            </div>
            <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${colors.text}`}
                style={{ width: `${progress}%`, background: "currentColor" }} />
            </div>
            <p className="text-label text-muted-foreground mt-1.5">
              {t("projects.stats_summary", { done: doneTodos.length, pending: pendingTodos.length, diary: projectDiaryMentions.length })}
            </p>
          </div>

          {/* Pending todos */}
          {pendingTodos.length > 0 && (
            <div>
              <p className="text-caption text-muted-foreground mb-2">{t("projects.in_progress")}</p>
              <div className="space-y-1.5">
                {pendingTodos.map(t => (
                  <div key={t.id} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status==="doing" ? "bg-los-orange" : "bg-muted-foreground/40"}`} />
                    <p className="text-sm text-foreground flex-1">{t.text}</p>
                    {t.dueDate && <span className="text-caption text-muted-foreground font-mono">{t.dueDate.slice(5)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed todos */}
          {doneTodos.length > 0 && (
            <div>
              <p className="text-caption text-muted-foreground mb-2">{t("projects.completed_count", { count: doneTodos.length })}</p>
              <div className="space-y-1.5">
                {doneTodos.slice(0, 10).map(t => (
                  <div key={t.id} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5 opacity-60">
                    <Check size={12} className="text-los-green flex-shrink-0" />
                    <p className="text-sm text-foreground line-through flex-1">{t.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diary mentions */}
          {projectDiaryMentions.length > 0 && (
            <div>
              <p className="text-caption text-muted-foreground mb-2">📔 {t("projects.diary_mentions")}</p>
              <div className="space-y-1.5">
                {projectDiaryMentions.map(e => (
                  <button key={e.id} onClick={() => navigate(`/history?date=${e.date}`)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-left hover:bg-surface-2 transition">
                    <p className="text-caption text-muted-foreground font-mono">{e.date}</p>
                    <p className="text-sm text-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {e.messages.find(m => m.role === "user")?.content.slice(0, 80)}…
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {projectTodos.length === 0 && projectDiaryMentions.length === 0 && (
            <div className="text-center py-10">
              <Folder size={32} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t("projects.empty_state_title")}</p>
              <p className="text-caption text-muted-foreground/60 mt-1">
                {t("projects.empty_state_hint_todo")}
              </p>
              <p className="text-caption text-muted-foreground/60 mt-1">
                {t("projects.empty_state_hint_ai", { name: selectedProject.name })}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="flex flex-col h-full max-w-[700px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[52px] border-b border-border flex-shrink-0 bg-surface-1/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="touch-target text-muted-foreground hover:text-foreground rounded-xl" style={{transform:"scale(0.85)"}}>
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif-sc text-base text-foreground">{t("projects.page_title")}</h1>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="touch-target text-primary hover:bg-primary/10 rounded-xl" style={{transform:"scale(0.85)"}}>
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-3 space-y-3 pb-8">

        {/* Create form */}
        {showCreate && (
          <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">{t("projects.create_new")}</p>
            {/* Emoji picker */}
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setNewEmoji(e)}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition
                    ${newEmoji===e ? "bg-primary/20 ring-2 ring-primary/50" : "bg-muted hover:bg-accent"}`}>
                  {e}
                </button>
              ))}
            </div>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder={t("projects.name_placeholder")}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary"
              onKeyDown={e => e.key === "Enter" && handleCreate()} autoFocus />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder={t("projects.description_placeholder")}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary" />
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-2 bg-muted text-muted-foreground rounded-xl text-sm">{t("projects.cancel")}</button>
              <button onClick={handleCreate} disabled={!newName.trim()}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-30">
                {t("projects.create")}
              </button>
            </div>
          </div>
        )}

        {/* Active projects */}
        {activeProjects.length === 0 && !showCreate && (
          <div className="text-center py-10">
            <Folder size={40} className="mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">{t("projects.no_projects_title")}</p>
            <p className="text-caption text-muted-foreground/60 mt-1 mb-4">
              {t("projects.no_projects_hint")}
            </p>
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium">
              <Plus size={14} /> {t("projects.create_new")}
            </button>
          </div>
        )}

        {/* Projects grid */}
        {activeProjects.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {activeProjects.map(p => {
              const c = PROJECT_COLORS[p.color];
              const todos = allTodos.filter(t => t.projectId === p.id);
              const done = todos.filter(t => t.status === "done").length;
              const pct = todos.length > 0 ? Math.round(done/todos.length*100) : 0;
              return (
                <button key={p.id} onClick={() => setSelectedProject(p)}
                  className={`text-left rounded-xl p-4 border transition hover:scale-[1.02] ${c.bg} ${c.border}`}>
                  <div className="text-2xl mb-2">{p.emoji}</div>
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  {p.description && <p className="text-caption text-muted-foreground truncate mt-0.5">{p.description}</p>}
                  <div className="flex items-center gap-1.5 mt-3">
                    <div className="flex-1 h-1 bg-black/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${c.text}`} style={{width:`${pct}%`, background:"currentColor"}} />
                    </div>
                    <span className={`text-label font-mono-jb ${c.text}`}>{pct}%</span>
                  </div>
                  <p className="text-label text-muted-foreground mt-1">{t("projects.task_count", { count: todos.length })}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Archived section */}
        {archivedProjects.length > 0 && (
          <div>
            <button onClick={() => setShowArchived(v => !v)}
              className="text-caption text-muted-foreground flex items-center gap-1 py-1">
              <Archive size={11} /> {t("projects.archived_count", { count: archivedProjects.length })}
            </button>
            {showArchived && (
              <div className="space-y-1.5 mt-1.5">
                {archivedProjects.map(p => (
                  <div key={p.id} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 opacity-50">
                    <span>{p.emoji}</span>
                    <p className="text-sm text-foreground flex-1">{p.name}</p>
                    <button onClick={() => deleteProject(p.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
