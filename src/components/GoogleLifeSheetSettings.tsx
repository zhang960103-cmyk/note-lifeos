import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleLifeSheet } from '@/hooks/useGoogleLifeSheet';
import { toast } from 'sonner';

export default function GoogleLifeSheetSettings() {
  const { user } = useAuth();
  const { connection, saveConfig, connect, disconnect, refresh } = useGoogleLifeSheet(user?.id);
  const [link, setLink] = useState(connection.config.spreadsheetId);
  const [clientId, setClientId] = useState(connection.config.clientId);
  const run = async (operation: () => Promise<void>) => {
    try { await operation(); } catch (error) { toast.error((error as Error).message); }
  };
  return <section className="rounded-2xl border border-border bg-card p-4 space-y-4" aria-labelledby="google-life-title">
    <div><h2 id="google-life-title" className="font-serif-sc text-base">Google 人生表格</h2>
      <p className="text-xs text-muted-foreground leading-6 mt-2">让表格里的待办、第一步和早晚会，成为 Life OS 的行动入口。默认只读，写回需要你另行授权。</p></div>
    <label className="block text-xs">人生表格链接<input value={link} onChange={event => setLink(event.target.value)}
      className="mt-2 w-full bg-surface-2 border border-border rounded-lg p-3 text-xs" placeholder="https://docs.google.com/spreadsheets/d/…" /></label>
    <details className="text-xs"><summary className="cursor-pointer min-h-11 flex items-center text-muted-foreground">首次连接设置</summary>
      <label className="block mt-2">Google 网页客户端 ID<input value={clientId} onChange={event => setClientId(event.target.value)}
        className="mt-2 w-full bg-surface-2 border border-border rounded-lg p-3 text-xs" placeholder="…apps.googleusercontent.com" /></label>
      <p className="text-[11px] text-muted-foreground leading-6 mt-2">管理员需要启用 Google Sheets API，并在 Google OAuth 网页客户端中允许当前 Life OS 网址。客户端 ID 是公开标识，不是密钥。请勿填写密码、API Key 或客户端密钥。</p>
      <a href="https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-gold underline">查看 Google 官方设置说明 ↗</a>
    </details>
    <div className="flex flex-wrap gap-2">
      <button className="min-h-11 px-4 rounded-lg bg-surface-2 border border-border text-xs" disabled={connection.busy} onClick={() => {
        try { saveConfig({ spreadsheetId: link, clientId }); toast.success('连接设置已保存。现在可以授权 Google。'); }
        catch (error) { toast.error((error as Error).message); }
      }}>保存连接设置</button>
      <button className="min-h-11 px-4 rounded-lg bg-gold/15 text-gold border border-gold/25 text-xs" disabled={connection.busy || !connection.config.clientId || !connection.config.spreadsheetId}
        onClick={() => run(() => connect(false))}>{connection.busy ? '连接处理中…' : connection.connected ? '重新授权' : '只读连接 Google'}</button>
      {connection.connected && <>
        {!connection.canWrite && <button className="min-h-11 px-4 rounded-lg border border-border text-xs" disabled={connection.busy} onClick={() => run(() => connect(true))}>允许写回表格</button>}
        <button className="min-h-11 px-4 rounded-lg border border-border text-xs" disabled={connection.busy} onClick={() => run(refresh)}>刷新表格</button>
        <button className="min-h-11 px-3 text-xs text-muted-foreground" onClick={disconnect}>断开 Google</button>
      </>}
    </div>
    <div role="status" className="text-xs leading-6 text-muted-foreground">
      {connection.snapshot ? <p>已读取「{connection.snapshot.title}」· {connection.canWrite ? '可按操作写回' : '只读'}<br />
        {connection.snapshot.tasks.length} 条待办 · 表格时区 {connection.snapshot.timeZone}</p> : <p>尚未读取表格。连接成功前，仍可使用 Life OS 自己的待办和行动记录。</p>}
      {connection.error && <p className="text-los-orange">{connection.error}</p>}
    </div>
    <p className="text-[10px] leading-5 text-muted-foreground">Google 授权只保留在当前页面会话内，不存储访问令牌。刷新后需重新授权。连接不要求把私人表格公开；写回仅更新你明确选择的操作，不自动覆盖其他页面。</p>
  </section>;
}
