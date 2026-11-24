import { AuditLogEvent, EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import { COLORS, findAuditEntry, isOurGuild, sendLog, when } from '../logger.js';

export default {
  name: Events.GuildRoleCreate,
  async execute(role, client) {
    if (!isOurGuild(role.guild)) return;
    const entry = await findAuditEntry(role.guild, AuditLogEvent.RoleCreate, role.id);
    await sendLog(
      client,
      config.channels.mod,
      new EmbedBuilder()
        .setColor(COLORS.good)
        .setTitle('🏷️ สร้างยศใหม่')
        .addFields(
          { name: 'ยศ', value: `${role} (${role.name})`, inline: true },
          { name: 'ผู้ดำเนินการ', value: entry?.executor ? `${entry.executor}` : 'ไม่ทราบ', inline: true },
          { name: 'เวลา', value: when() },
        )
        .setFooter({ text: `ID: ${role.id}` }),
    );
  },
};
