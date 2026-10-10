import { Blob as NodeBlob } from "node:buffer";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataExport from "./DataExport";
import DataImport from "./DataImport";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(), from: vi.fn(),
  data: { entries: [], allTodos: [] as Record<string, unknown>[], financeEntries: [], habits: [], wheelScores: [], energyLogs: [] },
}));
vi.mock("@/contexts/LifeOsContext", () => ({ useLifeOs: () => mocks.data }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "alice" } }) }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

let download: NodeBlob;
let revoke: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  mocks.data.allTodos = [];
  mocks.from.mockReset().mockReturnValue({ upsert: mocks.upsert });
  mocks.upsert.mockReset().mockResolvedValue({ error: null });
  revoke = vi.fn();
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL(blob: NodeBlob) { download = blob; return "blob:test"; }
    static revokeObjectURL = revoke;
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function importFile(json: unknown) {
  const { container } = render(<DataImport />);
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [{ text: async () => JSON.stringify(json) }] },
  });
  await screen.findByText("data_import.success");
}

describe("backup export", () => {
  it("exports schema version and only the current account's local extras", async () => {
    localStorage.setItem("budgets_alice", '[{"limit":100}]');
    localStorage.setItem("projects_alice", "[]");
    localStorage.setItem("budgets_bob", '[{"limit":999}]');
    localStorage.setItem("unrelated", "private");
    render(<DataExport />);
    fireEvent.click(screen.getByRole("button", { name: "settings.export_json" }));
    const json = JSON.parse(await download.text());
    expect(json).toMatchObject({ schemaVersion: 2, entries: [], todos: [], financeEntries: [] });
    expect(json.localExtras).toEqual({ budgets_alice: '[{"limit":100}]', projects_alice: "[]" });
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
  it("escapes CSV quotes, commas and multiline notes and includes a UTF-8 BOM", async () => {
    mocks.data.allTodos = [{ text: 'Buy "tea", milk', note: 'line 1\n"line 2"', tags: ["a", "b"], status: "todo", priority: "normal", sourceDate: "2026-01-01" }];
    render(<DataExport />);
    fireEvent.click(screen.getByRole("button", { name: "settings.export_csv" }));
    const bytes = new Uint8Array(await download.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([239, 187, 191]);
    const csv = await download.text();
    expect(csv).toContain('2026-01-01,"Buy ""tea"", milk",todo,normal,a;b,"line 1\n""line 2"""');
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
});

describe("backup import", () => {
  it("remaps whitelisted local data to the current account", async () => {
    await importFile({ entries: [], localExtras: { budgets_old: '[{"limit":100}]', projects_old: "[]", auth_old: "secret" } });
    expect(localStorage.getItem("budgets_alice")).toBe('[{"limit":100}]');
    expect(localStorage.getItem("projects_alice")).toBe("[]");
    expect(localStorage.getItem("budgets_old")).toBeNull();
    expect(localStorage.getItem("auth_alice")).toBeNull();
  });
  it("preserves existing local data and reports a partial import", async () => {
    localStorage.setItem("budgets_alice", '[{"limit":200}]');
    const { container } = render(<DataImport />);
    fireEvent.change(container.querySelector("input")!, { target: { files: [{ text: async () => JSON.stringify({ todos: [], localExtras: { budgets_old: "[]" } }) }] } });
    await screen.findByText("data_import.partial_success");
    expect(localStorage.getItem("budgets_alice")).toBe('[{"limit":200}]');
  });
  it("normalizes finance data and binds it to the importing account", async () => {
    await importFile({ todos: [], financeEntries: [{ id: "f1", date: "2026-01-02T12:00:00Z", type: "expense", amount: "12.50" }] });
    expect(mocks.from).toHaveBeenCalledWith("finance_entries");
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "f1", user_id: "alice", date: "2026-01-02", amount: 12.5, category: "", note: "" }), { onConflict: "id" });
  });
  it("rejects a backup without recognizable collections before writing", async () => {
    const { container } = render(<DataImport />);
    fireEvent.change(container.querySelector("input")!, { target: { files: [{ text: async () => "{}" }] } });
    await screen.findByText("data_import.error.invalid_backup");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("reports a database write failure instead of claiming full success", async () => {
    mocks.upsert.mockImplementation(async (row: { id: string }) => ({ error: row.id === "f1" ? { message: "denied" } : null }));
    const { container } = render(<DataImport />);
    fireEvent.change(container.querySelector("input")!, { target: { files: [{ text: async () => JSON.stringify({ todos: [], financeEntries: [{ id: "f1", type: "expense", amount: 10 }] }) }] } });
    await waitFor(() => expect(screen.getByText("[finance] denied")).toBeTruthy());
    expect(screen.queryByText("data_import.success")).toBeNull();
  });
});
