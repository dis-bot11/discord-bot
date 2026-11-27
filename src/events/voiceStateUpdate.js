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