import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Link2, Pause, Play, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useLifeOs } from '@/contexts/LifeOsContext';
import { useCoachJournal } from '@/hooks/useCoachJournal';
import { useGoogleLifeSheet } from '@/hooks/useGoogleLifeSheet';
import GoogleLifeSheetSettings from '@/components/GoogleLifeSheetSettings';
import { localDay, nextAction, pauseAction, resumeAction, remainingMs, toActionRecord, validateSession,
  formatCoachMessage, parseCoachMessage,
  type ActionSession, type CoachRecord, type MeetingRecord, type ActionRecord, type ActionSource } from '@/lib/actionCoach';

const inputClass = 'w-full rounded-xl bg-surface-2 border border-border p-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-gold/50';
const buttonClass = 'min-h-11 px-4 rounded-xl text-xs border border-border bg-surface-2 hover:bg-surface-3 disabled:opacity-50';
const primaryClass = 'min-h-11 px-5 rounded-xl text-sm font-medium bg-gold/20 text-gold border border-gold/30 disabled:opacity-50';
type Tab = 'action' | 'morning' | 'evening' | 'connect';
type Pending = { spreadsheetId: string; record: CoachRecord };
type SavedSession = ActionSession & { evidence?: string; nextStep?: string; pendingRecord?: ActionRecord };
function firstThree(value: string): string[] { return value.split(/\n|[①②③]/).map(line => line.replace(/^\s*[1-3][.、）)]\s*/, '').trim()).filter(Boolean); }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs space-y-2"><span>{label}</span>{children}</label>;
}

function CoachWorkspace({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { allTodos } = useLifeOs();
  const journal = useCoachJournal(userId);
  const sheet = useGoogleLifeSheet(userId);
  const activeTodos = allTodos.filter(todo => todo.status !== 'done' && todo.status !== 'dropped');
  const sessionKey = `lifeos-coach-session-${userId}`;
  const queueKey = `lifeos-coach-outbox-${userId}`;
  const draftKey = `lifeos-coach-meeting-draft-${userId}`;
  const sessionStorageHealthy = useRef(true);
  const queueStorageHealthy = useRef(true);
  const draftStorageHealthy = useRef(true);
  const [session, setSession] = useState<SavedSession | null>(() => {
    try { const raw = localStorage.getItem(sessionKey); return raw ? validateSession(JSON.parse(raw)) : null; }
    catch { sessionStorageHealthy.current = false; return null; }
  });
  const [pending, setPending] = useState<Pending[]>(() => {
    try { const raw = JSON.parse(localStorage.getItem(queueKey) || '[]');
      if (!Array.isArray(raw) || raw.length > 1000 || raw.some(item => !item || typeof item.spreadsheetId !== 'string' || !item.record?.id || !parseCoachMessage({ content: formatCoachMessage(item.record) }))) throw new Error();
      return raw;
    } catch { queueStorageHealthy.current = false; return []; }
  });
  const [storageIssue, setStorageIssue] = useState(!sessionStorageHealthy.current || !queueStorageHealthy.current);
  const [draft] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (value && value.version !== 1) { draftStorageHealthy.current = false; return {}; }
      if (!value || typeof value !== 'object' || (value.date !== localDay() && !value.meetingAttempt)) return {};
      return value;
    } catch { draftStorageHealthy.current = false; return {}; }
  });
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(requestedTab === 'morning' || requestedTab === 'evening' || requestedTab === 'connect' ? requestedTab : 'action');
  const initialTask = searchParams.get('task');
  const [selected, setSelected] = useState(initialTask ? `lifeos:${initialTask}` : 'free');
  const [task, setTask] = useState(session?.task || '');
  const [step, setStep] = useState(session?.step || '');
  const [duration, setDuration] = useState(120);
  const [now, setNow] = useState(Date.now());
  const [reflecting, setReflecting] = useState(!!session?.pendingRecord);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncWanted, setSyncWanted] = useState(!!sheet.connection.config.spreadsheetId);
  const [barrier, setBarrier] = useState('big');
  const draftText = (key: string) => typeof draft[key] === 'string' ? draft[key] : '';
  const [meetingId, setMeetingId] = useState(draftText('meetingId') || crypto.randomUUID());
  const [mainline, setMainline] = useState(draftText('mainline'));
  const [domain, setDomain] = useState(draftText('domain'));
  const [top3, setTop3] = useState(draftText('top3'));
  const [resources, setResources] = useState(draftText('resources'));
  const [energy, setEnergy] = useState([1,2,3,4,5].includes(draft.energy) ? draft.energy : 3);
  const [sleep, setSleep] = useState(draftText('sleep'));
  const [achieved, setAchieved] = useState([0,1,2,3].includes(draft.achieved) ? draft.achieved : 0);
  const [obstacle, setObstacle] = useState(draftText('obstacle'));
  const [optimize, setOptimize] = useState(draftText('optimize'));
  const [meetingAttempt, setMeetingAttempt] = useState<MeetingRecord | null>(() => {
    try { return ['morning','evening'].includes(draft.meetingAttempt?.kind) && parseCoachMessage({ content: formatCoachMessage(draft.meetingAttempt) }) ? draft.meetingAttempt : null; }
    catch { return null; }
  });
  const busy = useRef(false);
  const latestSession = useRef(session); latestSession.current = session;

  useEffect(() => {
    if (!sessionStorageHealthy.current) return;
    try { if (session) localStorage.setItem(sessionKey, JSON.stringify(session)); else localStorage.removeItem(sessionKey); }
    catch { sessionStorageHealthy.current = false; setStorageIssue(true); }
  }, [session, sessionKey]);
  useEffect(() => {
    if (!queueStorageHealthy.current) return;
    try { localStorage.setItem(queueKey, JSON.stringify(pending)); }
    catch { queueStorageHealthy.current = false; setStorageIssue(true); }
  }, [pending, queueKey]);
  useEffect(() => {
    if (!draftStorageHealthy.current) { setStorageIssue(true); return; }
    try { localStorage.setItem(draftKey, JSON.stringify({ version: 1, date: localDay(), meetingId, mainline, domain, top3, resources, energy, sleep, achieved, obstacle, optimize, meetingAttempt })); }
    catch { setStorageIssue(true); }
  }, [draftKey, meetingId, mainline, domain, top3, resources, energy, sleep, achieved, obstacle, optimize, meetingAttempt]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);
  // A second tab can observe the same timer; completion journal IDs remain stable.
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== sessionKey) return;
      try { setSession(event.newValue ? validateSession(JSON.parse(event.newValue)) : null); setReflecting(false); }
      catch { setStorageIssue(true); }
    };
    window.addEventListener('storage', changed); return () => window.removeEventListener('storage', changed);
  }, [sessionKey]);

  const zone = sheet.connection.snapshot?.timeZone;
  const today = localDay(new Date(), zone);
  const recordsToday = useMemo(() => journal.records.filter(record => localDay(new Date(record.completedAt), zone) === today), [journal.records, today, zone]);
  const actionsToday = recordsToday.filter((record): record is ActionRecord => record.kind === 'action');
  const sheetTasks = sheet.connection.snapshot?.tasks.filter(todo => !['完成', '搁置·放弃', '搜置·放弃', '放弃'].includes(todo.status)) || [];
  useEffect(() => {
    const morning = recordsToday.find((record): record is MeetingRecord => record.kind === 'morning');
    if (!morning) return;
    if (!mainline) setMainline(morning.mainline);
    if (!domain) setDomain(morning.domain);
    if (!top3) setTop3(morning.top3.join('\n'));
  }, [recordsToday]);

  const appliedSelection = useRef('');
  useEffect(() => {
    if (session) return;
    if (selected === 'free') { appliedSelection.current = ''; return; }
    if (appliedSelection.current === selected) return;
    if (selected.startsWith('lifeos:')) {
      const todo = allTodos.find(todo => todo.id === selected.slice(7));
      if (todo) { setTask(todo.text); setStep(nextAction(todo)); appliedSelection.current = selected; }
    } else if (selected.startsWith('sheet:')) {
      const todo = sheet.connection.snapshot?.tasks.find(todo => todo.id === selected.slice(6));
      if (todo) { setTask(todo.title); setStep(todo.nextAction || nextAction({ text: todo.title, subTasks: [] })); appliedSelection.current = selected; }
    }
  }, [selected, allTodos, sheet.connection.snapshot, session]);
  useEffect(() => {
    const snapshot = sheet.connection.snapshot;
    if (!snapshot) return;
    const morning = [...snapshot.morning].reverse().find(row => row[0] === today && row[1] === '早');
    const week = snapshot.weekly.find(row => row[0] <= today && row[1] >= today);
    if (!mainline) setMainline(morning?.[2] || week?.[2] || '');
    if (!domain) setDomain(morning?.[3] || week?.[3] || '');
    if (!top3 && morning?.[4]) setTop3(firstThree(morning[4]).slice(0, 3).join('\n'));
  }, [sheet.connection.snapshot, today]); // Existing edited fields are never replaced by a refresh.

  function enqueue(target: string, record: CoachRecord) {
    setPending(items => items.some(item => item.spreadsheetId === target && item.record.id === record.id) ? items : [...items, { spreadsheetId: target, record }]);
  }
  async function sendToSheet(record: CoachRecord) {
    const client = sheet.client(true);
    if (record.kind === 'action') {
      if (record.source.kind === 'sheet' && record.source.spreadsheetId !== client.id) throw new Error('该行动属于另一份表格，未发送到当前表格。');
      await client.appendAction(record);
    } else await client.appendMeeting(record);
  }
  async function persist(record: CoachRecord) {
    await journal.save(record);
    const target = record.kind === 'action' && record.source.kind === 'sheet' ? record.source.spreadsheetId : sheet.connection.config.spreadsheetId;
    if (syncWanted && target) {
      enqueue(target, record);
      try {
        await sendToSheet(record);
        setPending(items => items.filter(item => item.record.id !== record.id || item.spreadsheetId !== target));
        toast.success('已保存到 Life OS，并写入人生表格。');
      } catch (error) { toast.info(`Life OS 已保存；表格待同步：${(error as Error).message}`); }
    } else toast.success('已保存到 Life OS 日记。');
  }
  async function retryPending() {
    if (busy.current) return;
    busy.current = true; setSyncing(true);
    try {
      const target = sheet.connection.config.spreadsheetId;
      const batch = pending.filter(item => item.spreadsheetId === target);
      if (!batch.length) throw new Error('待同步记录属于其他表格，请先恢复相应连接。');
      for (const item of batch) {
        await sendToSheet(item.record);
        setPending(items => items.filter(current => current.record.id !== item.record.id || current.spreadsheetId !== target));
      }
      toast.success('本表的待同步记录已写入。');
    } catch (error) { toast.error((error as Error).message); }
    finally { busy.current = false; setSyncing(false); }
  }
  function start() {
    if (!task.trim() || !step.trim()) { toast.info('先写一件事，再把第一步写小一点。'); return; }
    if (latestSession.current) return;
    const source: ActionSource = selected.startsWith('lifeos:') ? { kind: 'lifeos', taskId: selected.slice(7) }
      : selected.startsWith('sheet:') ? { kind: 'sheet', taskId: selected.slice(6), spreadsheetId: sheet.connection.config.spreadsheetId } : { kind: 'free' };
    setSession({ id: crypto.randomUUID(), task: task.trim(), step: step.trim(), source, duration,
      remainingMs: duration * 1000, endAt: Date.now() + duration * 1000, status: 'running', startedAt: new Date().toISOString() });
    setReflecting(false);
  }
  async function finish() {
    if (!session || busy.current) return;
    busy.current = true; setSaving(true);
    const record = session.pendingRecord || toActionRecord(session, session.evidence || '', session.nextStep || '');
    setSession({ ...session, pendingRecord: record });
    try { await persist(record); setSession(null); setReflecting(false); }
    catch (error) { toast.error((error as Error).message); }
    finally { busy.current = false; setSaving(false); }
  }
  async function saveMeeting() {
    if (busy.current) return;
    const items = firstThree(top3);
    if (!mainline.trim()) { toast.info('给今天留一句主线就好。'); return; }
    if (items.length > 3) { toast.info('最多选三件事。精力低时，只留一件也很好。'); return; }
    if (tab === 'evening' && !obstacle.trim()) { toast.info('写下未完成的主因；都完成了可以写“已完成”。'); return; }
    const record: MeetingRecord = meetingAttempt || { kind: tab === 'morning' ? 'morning' : 'evening', id: meetingId, date: today,
      completedAt: new Date().toISOString(), mainline: mainline.trim(), domain: domain.trim(), top3: items,
      resources: resources.trim(), energy, sleep: sleep.trim(), achieved, obstacle: obstacle.trim(), optimize: optimize.trim() };
    setMeetingAttempt(record); busy.current = true; setSaving(true);
    try {
      await persist(record); setMeetingAttempt(null); setMeetingId(crypto.randomUUID());
      if (record.kind === 'morning' && record.top3[0] && !session) {
        const first = record.top3[0];
        const local = activeTodos.find(todo => first.includes(todo.text));
        const remote = sheetTasks.find(todo => first.includes(todo.title));
        if (local) setSelected(`lifeos:${local.id}`);
        else if (remote) setSelected(`sheet:${remote.id}`);
        else { setSelected('free'); setTask(record.mainline); setStep(first); }
        setDuration(120);
      }
      setTab('action');
    } catch (error) { toast.error((error as Error).message); }
    finally { busy.current = false; setSaving(false); }
  }
  const milliseconds = session ? remainingMs(session, now) : duration * 1000;
  const seconds = Math.ceil(milliseconds / 1000);
  const timer = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const barriers: Record<string, [string, string]> = {
    big: ['事情太大', '把“做完”换成“碰一下”：打开文件、写一行、核对一条。'],
    perfect: ['怕做不好', '给它起名“草稿”。这一轮只做一个可以修改的版本。'],
    tired: ['有点没电', '先喝水或离开屏幕两分钟。今天可以只做一小步，也可以先休息。'],
    phone: ['手机吸走我', '把手机放到够不到的地方，只留当前要用的页面。'],
  };

  return <div className="h-full flex flex-col max-w-[760px] mx-auto">
    <header className="flex items-center gap-3 p-4 border-b border-border">
      <button onClick={() => navigate('/')} className="touch-target" aria-label="返回今日"><ArrowLeft size={18} /></button>
      <div className="flex-1"><h1 className="font-serif-sc text-lg">先动一下 · 早晚会</h1><p className="text-[10px] text-muted-foreground">在自己的 Life OS 里，把计划接到行动。</p></div>
      <button className="touch-target text-gold" aria-label="Google 人生表格连接" onClick={() => setTab('connect')}><Link2 size={18} /></button>
    </header>
    <div className="flex px-3 pt-2 gap-1 border-b border-border" role="tablist" aria-label="行动与早晚会">
      {([['action', '现在行动'], ['morning', '早会'], ['evening', '晚会'], ['connect', '表格连接']] as const).map(([key, label]) =>
        <button key={key} role="tab" id={`coach-tab-${key}`} aria-controls={`coach-panel-${key}`} aria-selected={tab === key} onClick={() => setTab(key)}
          onKeyDown={event => {
            const tabs: Tab[] = ['action', 'morning', 'evening', 'connect'];
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[3] : tabs[(tabs.indexOf(key) + (event.key === 'ArrowRight' ? 1 : 3)) % 4];
            setTab(next); document.getElementById(`coach-tab-${next}`)?.focus();
          }}
          className={`flex-1 min-h-11 text-xs border-b-2 ${tab === key ? 'border-gold text-gold' : 'border-transparent text-muted-foreground'}`}>{label}</button>)}
    </div>
    <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4" role="tabpanel" id={`coach-panel-${tab}`} aria-labelledby={`coach-tab-${tab}`}>
      {storageIssue && <p role="alert" className="text-xs leading-6 p-3 rounded-xl bg-los-orange/10 text-los-orange">本地计时或同步队列无法保存，原数据未被覆盖。新的计时暂在当前页；离开前请先保存到 Life OS。已存入日记的记录可随时重新发送到表格。</p>}
      {pending.length > 0 && <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-los-orange/30 bg-los-orange/5">
        <p className="text-xs flex-1">{pending.length} 条记录已存 Life OS，等待写回表格。</p>
        <button className={buttonClass} disabled={syncing || !sheet.connection.canWrite} onClick={retryPending}>{syncing ? '正在同步…' : '重试同步'}</button></div>}
      {session && tab !== 'action' && <button className="w-full text-left text-xs p-3 bg-gold/10 border border-gold/25 rounded-xl" onClick={() => setTab('action')}>↗ {timer} · {session.step} · 返回这一轮</button>}

      {tab === 'connect' && <GoogleLifeSheetSettings />}
      {tab === 'action' && <>
        <section className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
          <p className="text-[10px] text-gold tracking-wider">现在只做眼前这一小步</p><h2 className="font-serif-sc text-2xl leading-relaxed mt-2">不用等状态，先动一下。</h2>
          <p className="text-xs leading-6 text-muted-foreground mt-2">今天已亲手确认 {actionsToday.length} 次小行动。推进了一步，不等于整件事都完成。</p>
        </section>
        {!session && <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <Field label="从哪里开始？"><select className={inputClass} value={selected} onChange={event => { setSelected(event.target.value); if (event.target.value === 'free') { setTask(''); setStep(''); } }}>
            <option value="free">自己写一件事</option>
            <optgroup label="Life OS 待办">{activeTodos.map(todo => <option key={todo.id} value={`lifeos:${todo.id}`}>{todo.text}</option>)}</optgroup>
            {sheetTasks.length > 0 && <optgroup label="Google 人生表格待办">{sheetTasks.map(todo => <option key={todo.id} value={`sheet:${todo.id}`}>{todo.title}</option>)}</optgroup>}
          </select></Field>
          {selected === 'free' && <Field label="我想推进的事"><input maxLength={300} className={inputClass} value={task} onChange={event => setTask(event.target.value)} placeholder="比如：核对课时、写方案、收拾桌子" /></Field>}
          {selected !== 'free' && <p className="text-xs leading-6 break-words">{task}</p>}
          {selected.startsWith('sheet:') && <button className="text-[11px] min-h-11 text-muted-foreground underline" disabled={saving} onClick={async () => {
            const expected = sheet.connection.snapshot?.tasks.find(todo => todo.id === selected.slice(6));
            if (!expected) return;
            if (!sheet.connection.canWrite) { setTab('connect'); toast.info('标为整件完成，需要先允许写回表格。'); return; }
            if (!window.confirm(`确认整件待办已经完成？\n${expected.title}\n只推进了一小步时，请保留原状态。`)) return;
            setSaving(true);
            try { await sheet.client(true).completeTask(expected, today); await sheet.refresh(); setSelected('free'); setTask(''); setStep(''); toast.success('已在表格中标为完成。'); }
            catch (error) { toast.error((error as Error).message); }
            finally { setSaving(false); }
          }}>这件表格待办，整体已经完成了…</button>}
          <Field label="第一步，小到现在能做"><textarea maxLength={500} rows={2} className={inputClass} value={step} onChange={event => setStep(event.target.value)} placeholder="比如：打开记录，只核对一条" /></Field>
          <div className="flex flex-wrap gap-2" role="group" aria-label="行动时长">{[120, 600, 1500].map(value => <button key={value} onClick={() => setDuration(value)} aria-pressed={duration === value}
            className={`${buttonClass} ${duration === value ? 'text-gold border-gold/40 bg-gold/10' : ''}`}>{value / 60} 分钟</button>)}</div>
          <button onClick={start} className={`${primaryClass} w-full flex items-center justify-center gap-2`}>就从这一步开始 <ArrowUpRight size={16} /></button>
          {!sheet.connection.connected && <button className="text-[11px] min-h-11 text-muted-foreground underline" onClick={() => setTab('connect')}>也想从 Google 人生表格里选待办？连接表格</button>}
        </section>}
        {session && <section className="bg-card border border-gold/30 rounded-2xl p-5 space-y-4">
          <p className="text-xs text-muted-foreground break-words">{session.task}</p><h2 className="text-base leading-7 break-words">{session.step}</h2>
          <div role="timer" aria-label={`剩余 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`} className="text-center font-mono text-6xl tracking-tight py-6 text-gold">{timer}</div>
          <p className="text-center text-xs text-muted-foreground" role="status">{milliseconds === 0 ? '时间到了。亲手确认这一小步做到了什么。' : session.status === 'paused' ? '暂停了，准备好就接着来。' : '现在只做这一件。切到后台后计时继续。'}</p>
          {!reflecting && <div className="flex gap-2">
            {milliseconds > 0 && <button className={`${buttonClass} flex-1 flex gap-2 justify-center items-center`} disabled={!!session.pendingRecord} onClick={() => setSession(session.status === 'running' ? pauseAction(session) : resumeAction(session))}>
              {session.status === 'running' ? <><Pause size={14} />暂停</> : <><Play size={14} />继续</>}</button>}
            <button className={`${primaryClass} flex-1`} onClick={() => { setSession(pauseAction(session)); setReflecting(true); }}>我做到了 ✓</button>
          </div>}
          {reflecting && <div className="space-y-4 border-t border-border pt-4">
            <Field label="做到的证据（可选）"><textarea className={inputClass} rows={2} maxLength={1000} value={session.evidence || ''} disabled={!!session.pendingRecord} onChange={event => setSession({ ...session, evidence: event.target.value })} placeholder="哪怕只写了一个标题，也算。" /></Field>
            <Field label="留给下一次的提示（可选）"><input className={inputClass} maxLength={300} value={session.nextStep || ''} disabled={!!session.pendingRecord} onChange={event => setSession({ ...session, nextStep: event.target.value })} placeholder="下次从哪一步继续？" /></Field>
            <button className={`${primaryClass} w-full`} disabled={saving} onClick={finish}>{saving ? '正在保存…' : session.pendingRecord ? '重试保存这一步' : '记下这一步，不自动划掉整件待办'}</button>
            {!session.pendingRecord && <button className="text-xs min-h-11 text-muted-foreground" onClick={() => setReflecting(false)}>返回计时（保持暂停）</button>}
          </div>}
          <button className="text-[11px] min-h-11 text-muted-foreground" disabled={saving} onClick={() => {
            if (session.pendingRecord) { toast.info('这轮保存结果尚未确认，请先重试保存，避免重复记录。'); return; }
            if (window.confirm('这轮先放下？不会记为完成，已保存的行动记录仍会保留。')) { setSession(null); setReflecting(false); }
          }}>这轮先放下</button>
        </section>}
        <section className="bg-card border border-border rounded-2xl p-4"><h2 className="text-sm">卡住的时候，先松开一点阻力。</h2>
          <div className="flex gap-2 flex-wrap my-3">{Object.entries(barriers).map(([key, value]) => <button key={key} aria-pressed={key === barrier} onClick={() => setBarrier(key)} className={`${buttonClass} ${key === barrier ? 'text-gold border-gold/30' : ''}`}>{value[0]}</button>)}</div>
          <p className="text-xs text-muted-foreground leading-6">{barriers[barrier][1]}</p></section>
      </>}

      {(tab === 'morning' || tab === 'evening') && <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div><p className="text-[10px] text-gold">{today} · {zone || '本地时区'}</p><h2 className="font-serif-sc text-xl mt-2">{tab === 'morning' ? '今天，先让一件重要的事动起来。' : '回看真实进展，给明天留一条路。'}</h2>
          <p className="text-xs leading-6 text-muted-foreground mt-2">{tab === 'morning' ? '三组信息就够：主线与 Top3、方法与资源、睡眠与精力。' : `今天留下了 ${actionsToday.length} 次小行动。微行动次数不等于 Top3 完成数，请按实际情况确认。`}</p></div>
        <fieldset disabled={!!meetingAttempt || saving} className="space-y-4">
          <Field label="今日主线"><input className={inputClass} value={mainline} maxLength={300} onChange={event => setMainline(event.target.value)} placeholder="今天最想推进哪件事？" /></Field>
          <Field label="所属领域（可选）"><input className={inputClass} value={domain} maxLength={100} onChange={event => setDomain(event.target.value)} placeholder="例如：工作 / 变富 / 身心健康" /></Field>
          <Field label="Top3，每行一件，写上第一步与时段"><textarea className={inputClass} rows={4} value={top3} maxLength={2000} onChange={event => setTop3(event.target.value)} placeholder={'核对课时：先打开一条记录，午饭前\n准备一节课：先写一个重点，14:00 前'} /></Field>
          {tab === 'morning' && <Field label="需要什么资源，可能卡在哪？"><textarea className={inputClass} rows={2} value={resources} maxLength={1000} onChange={event => setResources(event.target.value)} placeholder="先把需要的资料放到手边。" /></Field>}
          <div className="grid grid-cols-2 gap-3"><Field label="今天精力 1–5"><select className={inputClass} value={energy} onChange={event => setEnergy(Number(event.target.value))}>{[1,2,3,4,5].map(value => <option key={value} value={value}>{value} · {['想躺平','勉强撑着','正常','状态好','状态极好'][value-1]}</option>)}</select></Field>
            {tab === 'morning' && <Field label="睡眠（可选）"><input className={inputClass} value={sleep} maxLength={100} onChange={event => setSleep(event.target.value)} placeholder="例如：6.5h / 睡得不踏实" /></Field>}</div>
          {energy <= 2 && <p className="text-xs leading-6 text-los-orange">今天先顾好电量。主线只留一件也可以，新想法先记下，等状态恢复再决定。</p>}
          {tab === 'evening' && <>
            <Field label="Top3 实际完成几件？"><select className={inputClass} value={achieved} onChange={event => setAchieved(Number(event.target.value))}>{[0,1,2,3].map(value => <option key={value} value={value}>{value} 件</option>)}</select></Field>
            <Field label="没完成的主因（都完成可写“已完成”）"><input className={inputClass} maxLength={300} value={obstacle} onChange={event => setObstacle(event.target.value)} /></Field>
            <Field label="明天怎样更容易开始？"><textarea className={inputClass} rows={2} maxLength={1000} value={optimize} onChange={event => setOptimize(event.target.value)} placeholder="把第一步再缩小一点，或提前放好要用的东西。" /></Field>
          </>}
        </fieldset>
        {meetingAttempt && <p className="text-xs text-muted-foreground">保留了刚才提交的内容。重试会使用同一条记录，避免重复保存。</p>}
        <button className={`${primaryClass} w-full`} disabled={saving} onClick={saveMeeting}>{saving ? '正在保存…' : meetingAttempt ? '重试保存这次会议' : tab === 'morning' ? '保存早会，然后动一下 ↗' : '保存晚会，让明天好开始一点'}</button>
      </section>}

      {tab !== 'connect' && <label className="flex gap-3 items-start text-xs text-muted-foreground leading-6 p-1"><input type="checkbox" checked={syncWanted} onChange={event => setSyncWanted(event.target.checked)} className="mt-1" disabled={!sheet.connection.config.spreadsheetId} />
        <span>保存时写回已配置的人生表格。未授权或失败时，会明确保留“待同步”，不会当成已经写入。</span></label>}
      {tab !== 'connect' && journal.records.length > 0 && <section className="border border-border rounded-2xl bg-card p-4 space-y-3"><h2 className="text-sm">最近留下的行动证据</h2>
        {journal.records.slice(0, 8).map(record => <article key={record.id} className="border-t border-border pt-3 space-y-2">
          <p className="text-[10px] text-muted-foreground">{new Date(record.completedAt).toLocaleString('zh-CN')}</p>
          <p className="text-xs leading-6 break-words">{record.kind === 'action' ? record.step : `${record.kind === 'morning' ? '早会' : '晚会'}：${record.mainline}`}</p>
          {record.kind === 'action' && <><p className="text-xs text-muted-foreground break-words">{record.evidence || '亲手确认了这一小步。'}</p>{record.nextStep && <p className="text-xs text-gold/80 break-words">下次 → {record.nextStep}</p>}</>}
          {sheet.connection.config.spreadsheetId && <button className="text-[11px] text-muted-foreground min-h-11 inline-flex gap-1 items-center" onClick={() => { enqueue(sheet.connection.config.spreadsheetId, record); toast.info('已加入待同步，授权写回后点击“重试同步”。'); }}><RotateCcw size={11} />重新发送到当前表格</button>}
        </article>)}</section>}
      <p className="text-[10px] text-muted-foreground text-center leading-6">小步是真的，进展也是。中断了，就从下一步接着来。</p>
    </div>
  </div>;
}

export default function ActionPage() {
  const { user } = useAuth();
  return user ? <CoachWorkspace key={user.id} userId={user.id} /> : <p className="p-6 text-sm">请先登录 Life OS。</p>;
}
