import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { formatCoachMessage } from '@/lib/actionCoach';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), entryError: null as unknown, messageError: null as unknown,
  upserts: [] as { table: string; value: unknown; options: unknown }[], messages: [] as unknown[] }));
vi.mock('@/contexts/LifeOsContext', () => ({
  useLifeOs: () => ({ entries: [{ date: '2026-10-15', messages: mocks.messages }], refreshEntries: mocks.refresh }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => ({ upsert: (value: unknown, options: unknown) => {
    mocks.upserts.push({ table, value, options });
    return table === 'day_entries'
      ? { select: () => ({ single: async () => ({ data: mocks.entryError ? null : { id: 'entry-owned-by-user' }, error: mocks.entryError }) }) }
      : Promise.resolve({ error: mocks.messageError });
  } }),
} }));
import { useCoachJournal } from './useCoachJournal';
const record = { kind: 'action' as const, id: 'event-stable-id', task: '整理材料', step: '打开文件',
  source: { kind: 'free' as const }, seconds: 120, evidence: '写了一个标题', nextStep: '展开内容', completedAt: '2026-10-15T10:00:00Z' };

describe('coach journal uses existing user-owned storage', () => {
  beforeEach(() => { mocks.refresh.mockClear(); mocks.upserts = []; mocks.entryError = null; mocks.messageError = null; mocks.messages = []; });
  it('stores the same event UUID idempotently and refreshes only after success', async () => {
    const { result } = renderHook(() => useCoachJournal('user-one'));
    await act(async () => { await result.current.save(record); });
    expect(mocks.upserts[0]).toMatchObject({ table: 'day_entries', value: { user_id: 'user-one' } });
    expect(mocks.upserts[1]).toMatchObject({ table: 'chat_messages', value: { id: record.id, user_id: 'user-one', entry_id: 'entry-owned-by-user' }, options: { onConflict: 'id', ignoreDuplicates: true } });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it('rejects journal failures so a caller can retain its completion draft', async () => {
    mocks.messageError = new Error('rejected by RLS');
    const { result } = renderHook(() => useCoachJournal('user-one'));
    await expect(result.current.save(record)).rejects.toThrow('还没有存入');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('rejects missing auth or missing day entry before attempting a message write', async () => {
    const noUser = renderHook(() => useCoachJournal());
    await expect(noUser.result.current.save(record)).rejects.toThrow('登录');
    expect(mocks.upserts).toHaveLength(0);
    mocks.entryError = new Error('offline');
    const withUser = renderHook(() => useCoachJournal('user-one'));
    await expect(withUser.result.current.save(record)).rejects.toThrow('没能保存');
    expect(mocks.upserts).toHaveLength(1);
  });
  it('reads cloud journal actions and deduplicates repeated references', () => {
    mocks.messages = [{ role: 'user', content: formatCoachMessage(record) }, { role: 'user', content: formatCoachMessage(record) }];
    const { result } = renderHook(() => useCoachJournal('user-one'));
    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].id).toBe(record.id);
  });
});
