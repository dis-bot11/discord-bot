import { AuditLogEvent, EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import {
  COLORS,
  claimEntry,
  describeExecutor,
  findRecentAuditEntry,
  isOurGuild,
  sendLog,
  when,
} from '../logger.js';
import { supabase, addVoiceMinutes } from '../utils/supabase.js';

export const activeSessions = new Map();

// ⚙️ ใส่เลข Role ID ของแต่ละยศตรงนี้ครับ
export const RANK_TIERS = [
  { hours: 50, roleId: '1573540691164926042' },
  { hours: 100, roleId: '1573540865350311956' },
  { hours: 250, roleId: '1573541072095682591' },
  { hours: 500, roleId: '1573553344738234498' },
];

async function recordAndCheckVoiceTime(member, userId) {
  const joinedAt = activeSessions.get(userId);
  if (!joinedAt) return;

  // ลบออกจาก Memory ทันทีเพื่อป้องกันการบันทึกซ้ำซ้อน
  activeSessions.delete(userId);

  const durationMinutes = Math.floor((Date.now() - joinedAt) / 60000);
  if (durationMinutes <= 0) return;

  // ☁️ บันทึกเวลาเพิ่มลง Supabase
  await addVoiceMinutes(userId, durationMinutes);

  // ดึงเวลาสะสมล่าสุดของ User คนนี้จาก Supabase มาเช็คยศ
  const { data, error } = await supabase
    .from('voice_times')
    .select('minutes')
    .eq('user_id', userId)
    .single();

  if (error || !data) return;

  const totalHours = Math.floor(data.minutes / 60);

  for (const tier of RANK_TIERS) {
    if (totalHours >= tier.hours && tier.roleId && !tier.roleId.includes('ใส่_ROLE_ID')) {
      if (!member.roles.cache.has(tier.roleId)) {
        try {
          await member.roles.add(tier.roleId, `ออนห้องเสียงสะสมครบ ${tier.hours} ชั่วโมง`);
          console.log(`[VoiceReward] แจกยศ ${tier.hours} ชม. ให้ ${member.user.tag} สำเร็จ`);
        } catch (err) {
          console.error(`[VoiceReward Error] ใส่ยศให้ ${member.user.tag} ไม่สำเร็จ:`, err);
        }
      }
    }
  }
}

const SERVER_STATES = [
  {
    prop: 'serverMute',
    key: 'mute',
    on: { title: '🔇 ถูกปิดไมค์ (Server Mute)', color: COLORS.bad },
    off: { title: '🎙️ ถูกเปิดไมค์ (ปลด Server Mute)', color: COLORS.good },
  },
  {
    prop: 'serverDeaf',
    key: 'deaf',
    on: { title: '🙉 ถูกปิดหู (Server Deafen)', color: COLORS.bad },
    off: { title: '👂 ถูกเปิดหู (ปลด Server Deafen)', color: COLORS.good },
  },
];

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState, client) {
    if (!isOurGuild(newState.guild)) return;

    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const guild = newState.guild;
    const oldChannel = oldState.channelId;
    const newChannel = newState.channelId;
    const afkChannelId = guild.afkChannelId;
    const userId = member.id;

    // ⏱️ [ระบบจับเวลา] จัดการสถานะห้องเสียงแบบละเอียดและแม่นยำที่สุด
    const isOldAfk = oldChannel && oldChannel === afkChannelId;
    const isNewAfk = newChannel && newChannel === afkChannelId;

    // 1. เข้าห้องปกติครั้งแรก (จากไม่มีห้อง หรือย้ายออกจากห้อง AFK มาห้องปกติ)
    if ((!oldChannel && newChannel && !isNewAfk) || (isOldAfk && newChannel && !isNewAfk)) {
      activeSessions.set(userId, Date.now());
    }
    // 2. ออกจากห้องปกติ หรือย้ายเข้าห้อง AFK -> บันทึกเวลาสะสมแล้วหยุดนับ
    else if ((oldChannel && !isOldAfk && !newChannel) || (oldChannel && !isOldAfk && isNewAfk)) {
      await recordAndCheckVoiceTime(member, userId);
    }
    // 3. ย้ายห้องปกติไปยังห้องปกติอื่น (Switch Channel ระหว่างห้องใช้งานจริง)
    else if (oldChannel && newChannel && !isOldAfk && !isNewAfk && oldChannel !== newChannel) {
      await recordAndCheckVoiceTime(member, userId);
      activeSessions.set(userId, Date.now());
    }

    // 1. ตรวจสอบการเปลี่ยนสถานะ Mute / Deaf ในห้องเดิม
    if (oldChannel && oldChannel === newChannel) {
      for (const state of SERVER_STATES) {
        if (Boolean(oldState[state.prop]) === Boolean(newState[state.prop])) continue;

        const isOn = Boolean(newState[state.prop]);
        const style = isOn ? state.on : state.off;
        const entry = await findRecentAuditEntry(guild, AuditLogEvent.MemberUpdate, (e) =>
          e.targetId === member.id && e.changes?.some((c) => c.key === state.key),
        );

        await sendLog(
          client,
          config.channels.mod,
          new EmbedBuilder()
            .setColor(style.color)
            .setTitle(style.title)
            .addFields(
              { name: 'ผู้ถูกกระทำ', value: `${member.user} (${member.user.tag})`, inline: true },
              { name: 'ผู้ดำเนินการ', value: describeExecutor(entry, client, 'voice_update', member.id), inline: true },
              { name: 'ห้องเสียง', value: `<#${newChannel}>`, inline: true },
              { name: 'เวลา', value: when() },
            )
            .setFooter({ text: `ID: ${member.id}` }),
        );
      }
      return;
    }

    // 2. กรณีเข้าห้องเสียงจากข้างนอก
    if (!oldChannel && newChannel) {
      await sendLog(
        client,
        config.channels.voice,
        new EmbedBuilder()
          .setColor(COLORS.good)
          .setTitle('🔊 เข้าห้องเสียง')
          .setDescription(`${member.user} (${member.user.tag})\nเข้า <#${newChannel}>`)
          .setFooter({ text: `ID: ${member.id}` }),
      );
      return;
    }

    // 3. กรณีเปลี่ยนห้องเสียง
    if (oldChannel && newChannel) {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const moveEntry = await findRecentAuditEntry(guild, AuditLogEvent.MemberMove);
      const isForcedMove = Boolean(moveEntry) && claimEntry(moveEntry, Number(moveEntry.extra?.count) || 1);
      
      const executorDesc = describeExecutor(moveEntry, client, 'voice_move', member.id);
      const hasExecutor = isForcedMove || (moveEntry?.executor && moveEntry.executor.id !== member.id);

      await sendLog(
        client,
        config.channels.voice,
        new EmbedBuilder()
          .setColor(hasExecutor ? COLORS.warn : COLORS.info)
          .setTitle(hasExecutor ? '🔀 ถูกย้ายห้องเสียงโดยผู้อื่น' : '🔀 ย้ายห้องเสียง')
          .setDescription(
            `${member.user} (${member.user.tag})\n<#${oldChannel}> ➜ <#${newChannel}>` +
            `${hasExecutor ? `\n👑 **ผู้ดำเนินการ:** ${executorDesc}` : ''}`
          )
          .setFooter({ text: `ID: ${member.id}` }),
      );

      if (hasExecutor) {
        await sendLog(
          client,
          config.channels.mod,
          new EmbedBuilder()
            .setColor(COLORS.warn)
            .setTitle('🔀 ถูกย้ายห้องเสียงโดยผู้อื่น')
            .addFields(
              { name: 'ผู้ถูกกระทำ', value: `${member.user} (${member.user.tag})`, inline: true },
              { name: 'ผู้ดำเนินการ', value: executorDesc, inline: true },
              { name: 'จากห้อง', value: `<#${oldChannel}>`, inline: true },
              { name: 'ไปห้อง', value: `<#${newChannel}>`, inline: true },
              { name: 'เวลา', value: when() },
            )
            .setFooter({ text: `ID: ${member.id}` }),
      );
      }
      return;
    }

    // 4. กรณีออกจากห้องเสียง
    if (oldChannel && !newChannel) {
      const entry = await findRecentAuditEntry(guild, AuditLogEvent.MemberDisconnect, (e) => e.targetId === member.id);
      const forced = Boolean(entry) && claimEntry(entry, Number(entry.extra?.count) || 1);

      await sendLog(
        client,
        config.channels.voice,
        new EmbedBuilder()
          .setColor(forced ? COLORS.bad : COLORS.warn)
          .setTitle(forced ? '⛔ ถูกตัดการเชื่อมต่อห้องเสียง' : '🔇 ออกจากห้องเสียง')
          .setDescription(`${member.user} (${member.user.tag})\nออกจาก <#${oldChannel}>`)
          .setFooter({ text: `ID: ${member.id}` }),
      );

      if (forced) {
        await sendLog(
          client,
          config.channels.mod,
          new EmbedBuilder()
            .setColor(COLORS.bad)
            .setTitle('⛔ ถูกตัดการเชื่อมต่อห้องเสียง')
            .addFields(
              { name: 'ผู้ถูกกระทำ', value: `${member.user} (${member.user.tag})`, inline: true },
              { name: 'ผู้ดำเนินการ', value: describeExecutor(entry, client, 'voice_disconnect', member.id), inline: true },
              { name: 'ห้องเสียง', value: `<#${oldChannel}>`, inline: true },
              { name: 'เวลา', value: when() },
            )
            .setFooter({ text: `ID: ${member.id}` }),
      );
      }
    }
  },
};