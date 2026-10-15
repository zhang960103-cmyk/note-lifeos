import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLifeOs } from '@/contexts/LifeOsContext';
import { coachRecords, formatCoachMessage, localDay, type CoachRecord } from '@/lib/actionCoach';

/** Use existing journal tables and RLS; no new database schema or privileged key. */
export function useCoachJournal(userId?: string) {
  const { entries, refreshEntries } = useLifeOs();
  const records = useMemo(() => coachRecords(entries.flatMap(entry => entry.messages)), [entries]);
  const save = useCallback(async (record: CoachRecord) => {
    if (!userId) throw new Error('请先登录 Life OS 再保存。');
    const date = record.kind === 'action' ? localDay(new Date(record.completedAt)) : record.date;
    const { data: entry, error: entryError } = await supabase.from('day_entries')
      .upsert({ user_id: userId, date }, { onConflict: 'user_id,date' }).select('id').single();
    if (entryError || !entry) throw new Error('没能保存到 Life OS，内容仍保留在当前页面，请重试。');
    // Stable event IDs make a retry after an uncertain response safe for the journal.
    const { error } = await supabase.from('chat_messages').upsert({
      id: record.id, entry_id: entry.id, user_id: userId,
      role: 'user', content: formatCoachMessage(record), timestamp: record.completedAt,
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error('行动还没有存入 Life OS，内容已保留，请重试。');
    refreshEntries();
  }, [userId, refreshEntries]);
  return { records, save };
}
