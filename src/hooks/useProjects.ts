/**
 * 项目管理 Hook — localStorage 存储，按 userId 隔离
 * 兼容现有 TodoItem（projectId 为可选字段）
 */
import { useState, useCallback } from "react";
import type { Project, ProjectColor } from "@/types/lifeOs";

const PROJECT_COLORS: Record<ProjectColor, { bg: string; border: string; text: string }> = {
  gold:   { bg: "bg-gold/10",     border: "border-gold/30",     text: "text-gold" },
  blue:   { bg: "bg-los-blue/10", border: "border-los-blue/30", text: "text-los-blue" },
  green:  { bg: "bg-los-green/10",border: "border-los-green/30",text: "text-los-green" },
  red:    { bg: "bg-destructive/10",border:"border-destructive/30",text:"text-destructive" },
  purple: { bg: "bg-los-purple/10",border:"border-los-purple/30",text:"text-los-purple" },
  orange: { bg: "bg-los-orange/10",border:"border-los-orange/30",text:"text-los-orange" },
  teal:   { bg: "bg-los-teal/10",  border:"border-los-teal/30",  text:"text-los-teal" },
};
export { PROJECT_COLORS };

const COLOR_CYCLE: ProjectColor[] = ["gold","blue","green","purple","orange","teal","red"];

function getKey(uid: string) { return `projects_${uid}`; }
function load(uid: string): Project[] {
  try { return JSON.parse(localStorage.getItem(getKey(uid)) || "[]"); } catch { return []; }
}
function save(uid: string, data: Project[]) {
  localStorage.setItem(getKey(uid), JSON.stringify(data));
}

export function useProjects(userId: string | undefined) {
  const uid = userId || "guest";
  const [projects, setProjects] = useState<Project[]>(() => load(uid));

  const addProject = useCallback((name: string, emoji: string, description?: string): Project => {
    const all = load(uid);
    const color = COLOR_CYCLE[all.length % COLOR_CYCLE.length];
    const p: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      emoji,
      color,
      description,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [p, ...all];
    save(uid, next);
    setProjects(next);
    return p;
  }, [uid]);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p);
      save(uid, next);
      return next;
    });
  }, [uid]);

  const archiveProject = useCallback((id: string) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, archived: true } : p);
      save(uid, next);
      return next;
    });
  }, [uid]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id);
      save(uid, next);
      return next;
    });
  }, [uid]);

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  return { projects, activeProjects, archivedProjects, addProject, updateProject, archiveProject, deleteProject };
}
