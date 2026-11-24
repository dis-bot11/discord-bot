import { AuditLogEvent, ChannelType, EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import { COLORS, findAuditEntry, isOurGuild, sendLog, when } from '../logger.js';

export default {
  name: Events.ChannelDelete,
  async execute(channel, client) {
    if (!channel.guild || !isOurGuild(channel.guild)) return;

    const entry = await findAuditEntry(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    await sendLog(
      client,
      config.channels.mod,
      new EmbedBuilder()
        .setColor(COLORS.bad)
        .setTitle('🗑️ ลบห้อง')
        .addFields(
          { name: 'ชื่อห้อง', value: channel.name, inline: true },
          { name: 'ประเภท', value: ChannelType[channel.type] ?? String(channel.type), inline: true },
          { name: 'หมวดหมู่', value: channel.parent?.name ?? '—', inline: true },
          { name: 'ผู้ดำเนินการ', value: entry?.executor ? `${entry.executor}` : 'ไม่ทราบ', inline: true },
          { name: 'เวลา', value: when() },
        )
        .setFooter({ text: `ID: ${channel.id}` }),
    );
  },
};
