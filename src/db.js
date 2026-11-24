import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false },
});

export async function assignMemberNumber(guildId, userId, username) {
  const { data, error } = await supabase.rpc('assign_member_number', {
    p_guild_id: guildId,
    p_user_id: userId,
    p_username: username,
  });

  if (error) {
    console.error('[db] assign_member_number ล้มเหลว:', error.message);
    return null;
  }
  return data;
}

export async function markMemberLeft(guildId, userId) {
  const { error } = await supabase
    .from('members')
    .update({ left_at: new Date().toISOString() })
    .eq('guild_id', guildId)
    .eq('user_id', userId);

  if (error) console.error('[db] markMemberLeft ล้มเหลว:', error.message);
}

export async function getMemberNumber(guildId, userId) {
  const { data, error } = await supabase
    .from('members')
    .select('member_number')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[db] getMemberNumber ล้มเหลว:', error.message);
    return null;
  }
  return data?.member_number ?? null;
}

export async function getChartMessage(guildId) {
  const { data, error } = await supabase
    .from('chart_messages')
    .select('channel_id, message_id')
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) {
    console.error('[db] getChartMessage ล้มเหลว:', error.message);
    return null;
  }
  return data;
}

export async function saveChartMessage(guildId, channelId, messageId) {
  const { error } = await supabase
    .from('chart_messages')
    .upsert({ guild_id: guildId, channel_id: channelId, message_id: messageId });
  if (error) console.error('[db] saveChartMessage ล้มเหลว:', error.message);
  return !error;
}

export async function addPunishment(row) {
  const { data, error } = await supabase.from('punishments').insert(row).select('id').single();
  if (error) {
    console.error('[db] addPunishment ล้มเหลว:', error.message);
    return null;
  }
  return data.id;
}

export async function getPunishments(guildId, userId, limit = 50) {
  const { data, error } = await supabase
    .from('punishments')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[db] getPunishments ล้มเหลว:', error.message);
    return null;
  }
  return data;
}

export async function addNotice(row) {
  const { data, error } = await supabase.from('notices').insert(row).select('id').single();
  if (error) {
    console.error('[db] addNotice ล้มเหลว:', error.message);
    return null;
  }
  return data.id;
}

export async function getNotices(guildId, userId, limit = 20) {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[db] getNotices ล้มเหลว:', error.message);
    return null;
  }
  return data;
}