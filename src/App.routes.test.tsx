import type { PropsWithChildren } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "test" }, loading: false, isSupabaseConfigured: true }) }));
vi.mock("@/hooks/useReminders", () => ({ useReminders: () => {} }));
vi.mock("@/integrations/supabase/validate", () => ({ initSupabaseHealth: () => {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } } }));
vi.mock("@/contexts/LifeOsContext", () => ({
  LifeOsProvider: ({ children }: PropsWithChildren) => children,
  useLifeOs: () => ({ onboarded: true }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  LanguageProvider: ({ children }: PropsWithChildren) => children,
  useLanguage: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/TabBar", () => ({ default: () => null }));
vi.mock("@/components/InstallBanner", () => ({ default: () => null }));

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

it("resolves the lazy privacy route inside the authenticated layout", async () => {
  window.history.replaceState({}, "", "/privacy");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "privacy.title" })).toBeTruthy();
});

it("resolves the top-level lazy reset-password route outside AuthGate", async () => {
  window.history.replaceState({}, "", "/reset-password");
  render(<App />);
  expect(await screen.findByText("reset_password.invalid_link")).toBeTruthy();
});

it("resolves the lazy not-found route", async () => {
  window.history.replaceState({}, "", "/does-not-exist");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "404" })).toBeTruthy();
});
