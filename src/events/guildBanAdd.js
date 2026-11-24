import { AuditLogEvent, EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import { COLORS, describeExecutor, findAuditEntry, isOurGuild, sendLog, truncate, when } from '../logger.js';

export default {
  name: Events.GuildBanAdd,
  async execute(ban, client) {
    if (!isOurGuild(ban.guild)) return;

    const entry = await findAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);

    await sendLog(
      client,
      config.channels.mod,
      new EmbedBuilder()
        .setColor(COLORS.bad)
        .setTitle('🔨 สมาชิกถูกแบน')
        .addFields(
          { name: 'ผู้ถูกแบน', value: `${ban.user} (${ban.user.tag})`, inline: true },
          { name: 'ผู้ดำเนินการ', value: describeExecutor(entry, client, 'ban', ban.user.id), inline: true },
          { name: 'เหตุผล', value: truncate(entry?.reason ?? ban.reason ?? 'ไม่ได้ระบุ') },
          { name: 'เวลา', value: when() },
        )
        .setFooter({ text: `ID: ${ban.user.id}` }),
    );
  },
};
