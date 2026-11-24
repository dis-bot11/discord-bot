import { AuditLogEvent, EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import { scheduleChartRefresh } from '../chart.js';
import { COLORS, findAuditEntry, isOurGuild, sendLog, when } from '../logger.js';

export default {
  name: Events.GuildRoleDelete,
  async execute(role, client) {
    if (!isOurGuild(role.guild)) return;
    scheduleChartRefresh(client);
    const entry = await findAuditEntry(role.guild, AuditLogEvent.RoleDelete, role.id);
    await sendLog(
      client,
      config.channels.mod,
      new EmbedBuilder()
        .setColor(COLORS.bad)
        .setTitle('🗑️ ลบยศ')
        .addFields(
          { name: 'ชื่อยศ', value: role.name, inline: true },
          { name: 'ผู้ดำเนินการ', value: entry?.executor ? `${entry.executor}` : 'ไม่ทราบ', inline: true },
          { name: 'เวลา', value: when() },
        )
        .setFooter({ text: `ID: ${role.id}` }),
    );
  },
};
