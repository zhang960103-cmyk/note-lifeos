import { useSyncExternalStore } from 'react';
import { GoogleLifeSheet, spreadsheetId, SHEETS_READ_SCOPE, SHEETS_WRITE_SCOPE, type SheetSnapshot } from '@/lib/googleLifeSheet';

interface TokenReply { access_token?: string; expires_in?: number; scope?: string; error?: string }
interface TokenClient { requestAccessToken: (options?: { prompt?: string }) => void }
declare global {
  interface Window {
    google?: { accounts: { oauth2: {
      initTokenClient: (config: { client_id: string; scope: string; include_granted_scopes: boolean;
        callback: (response: TokenReply) => void; error_callback: (error: { type: string }) => void }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    } } };
  }
}
export interface SheetConfig { spreadsheetId: string; clientId: string }
interface Connection { config: SheetConfig; connected: boolean; canWrite: boolean; busy: boolean; error: string; snapshot: SheetSnapshot | null }
interface Internal { view: Connection; token: string; expiresAt: number; listeners: Set<() => void> }
const connections = new Map<string, Internal>();
let gisPromise: Promise<void> | null = null;
function slot(userId: string): Internal {
  if (!connections.has(userId)) {
    let config = { spreadsheetId: '', clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '' };
    try {
      const saved = JSON.parse(localStorage.getItem(`lifeos-sheet-${userId}`) || 'null');
      if (saved && typeof saved.spreadsheetId === 'string' && typeof saved.clientId === 'string') config = saved;
    } catch { /* Configuration can be entered again without touching journal data. */ }
    connections.set(userId, { view: { config, connected: false, canWrite: false, busy: false, error: '', snapshot: null }, token: '', expiresAt: 0, listeners: new Set() });
  }
  return connections.get(userId)!;
}
function update(userId: string, changes: Partial<Connection>) {
  const value = slot(userId); value.view = { ...value.view, ...changes };
  value.listeners.forEach(listener => listener());
}
function loadGoogle(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) gisPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    const timeout = setTimeout(() => { script.remove(); reject(new Error('Google 连接组件加载超时，请检查网络后重试。')); }, 15000);
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('Google 连接组件未加载，请检查网络后重试。')); };
    document.head.append(script);
  }).catch(error => { gisPromise = null; throw error; });
  return gisPromise;
}
export function useGoogleLifeSheet(userId = '') {
  const connection = useSyncExternalStore(callback => {
    const current = slot(userId); current.listeners.add(callback);
    return () => { current.listeners.delete(callback); };
  }, () => slot(userId).view);
  function client(write = false) {
    const current = slot(userId);
    if (!userId || !current.token || current.expiresAt <= Date.now()) {
      update(userId, { connected: false, canWrite: false });
      throw new Error('请先连接 Google 表格；刷新或授权过期后需重新连接。');
    }
    if (write && !current.view.canWrite) throw new Error('目前是只读连接，请先点击“允许写回表格”。');
    return new GoogleLifeSheet(current.view.config.spreadsheetId, current.token);
  }
  async function refresh() {
    update(userId, { busy: true, error: '' });
    try { update(userId, { snapshot: await client().snapshot() }); }
    catch (error) { update(userId, { error: (error as Error).message }); throw error; }
    finally { update(userId, { busy: false }); }
  }
  function saveConfig(config: SheetConfig) {
    if (!userId) throw new Error('请先登录 Life OS。');
    const normalized = { spreadsheetId: spreadsheetId(config.spreadsheetId), clientId: config.clientId.trim() };
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(normalized.clientId)) throw new Error('请填写 Google OAuth 网页客户端 ID（以 apps.googleusercontent.com 结尾）。');
    localStorage.setItem(`lifeos-sheet-${userId}`, JSON.stringify(normalized));
    const current = slot(userId); current.token = ''; current.expiresAt = 0;
    update(userId, { config: normalized, connected: false, canWrite: false, snapshot: null, error: '' });
    // Prepare the SDK after explicit configuration, keeping the next click direct.
    void loadGoogle().catch(() => undefined);
  }
  async function connect(write = false) {
    const current = slot(userId);
    if (!userId || !current.view.config.clientId || !current.view.config.spreadsheetId) throw new Error('请先保存表格链接与 Google 客户端 ID。');
    update(userId, { busy: true, error: '' });
    try {
      await loadGoogle();
      const token = await new Promise<TokenReply>((resolve, reject) => {
        const tokenClient = window.google!.accounts.oauth2.initTokenClient({ client_id: current.view.config.clientId,
          scope: write ? SHEETS_WRITE_SCOPE : SHEETS_READ_SCOPE, include_granted_scopes: true,
          callback: response => response.error ? reject(new Error('Google 授权未完成，请重新连接。')) : resolve(response),
          error_callback: () => reject(new Error('Google 授权窗口未完成，请允许弹窗后再试。')) });
        tokenClient.requestAccessToken({ prompt: 'consent' });
      });
      if (!token.access_token) throw new Error('没有获得 Google 授权，请重新连接。');
      current.token = token.access_token;
      current.expiresAt = Date.now() + Math.max(0, (token.expires_in || 3600) - 60) * 1000;
      update(userId, { connected: true, canWrite: (token.scope || '').split(' ').includes(SHEETS_WRITE_SCOPE) });
      await refresh();
    } catch (error) { update(userId, { error: (error as Error).message }); throw error; }
    finally { update(userId, { busy: false }); }
  }
  function disconnect() {
    const current = slot(userId); const token = current.token;
    current.token = ''; current.expiresAt = 0;
    update(userId, { connected: false, canWrite: false, snapshot: null });
    if (token) window.google?.accounts.oauth2.revoke(token);
  }
  return { connection, saveConfig, connect, disconnect, refresh, client };
}
