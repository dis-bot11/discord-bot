import { AuditLogEvent, ChannelType, EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import { COLORS, findAuditEntry, isOurGuild, sendLog, when } from '../logger.js';

export default {
  name: Events.ChannelCreate,
  async execute(channel, client) {
    if (!channel.guild || !isOurGuild(channel.guild)) return;

    const entry = await findAuditEntry(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    await sendLog(
      client,
      config.channels.mod,
      new EmbedBuilder()
        .setColor(COLORS.good)
        .setTitle('📁 สร้างห้องใหม่')
        .addFields(
          { name: 'ห้อง', value: `<#${channel.id}> (${channel.name})`, inline: true },
          { name: 'ประเภท', value: ChannelType[channel.type] ?? String(channel.type), inline: true },
          { name: 'หมวดหมู่', value: channel.parent?.name ?? '—', inline: true },
          { name: 'ผู้ดำเนินการ', value: entry?.executor ? `${entry.executor}` : 'ไม่ทราบ', inline: true },
          { name: 'เวลา', value: when() },
        )
        .setFooter({ text: `ID: ${channel.id}` }),
    );
  },
};
