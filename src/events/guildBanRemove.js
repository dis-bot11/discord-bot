import { AuditLogEvent, EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import { COLORS, describeExecutor, findAuditEntry, isOurGuild, sendLog, truncate, when } from '../logger.js';

export default {
  name: Events.GuildBanRemove,
  async execute(ban, client) {
    if (!isOurGuild(ban.guild)) return;

    const entry = await findAuditEntry(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);

    await sendLog(
      client,
      config.channels.mod,
      new EmbedBuilder()
        .setColor(COLORS.good)
        .setTitle('✅ ปลดแบนสมาชิก')
        .addFields(
          { name: 'ผู้ถูกปลดแบน', value: `${ban.user} (${ban.user.tag})`, inline: true },
          { name: 'ผู้ดำเนินการ', value: describeExecutor(entry, client, 'unban', ban.user.id), inline: true },
          { name: 'เหตุผล', value: truncate(entry?.reason ?? 'ไม่ได้ระบุ') },
          { name: 'เวลา', value: when() },
        )
        .setFooter({ text: `ID: ${ban.user.id}` }),
    );
  },
};
