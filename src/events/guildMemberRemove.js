import { AuditLogEvent, EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import { scheduleChartRefresh } from '../chart.js';
import { getMemberNumber, markMemberLeft } from '../db.js';
import { COLORS, describeExecutor, findAuditEntry, isOurGuild, sendLog, truncate } from '../logger.js';

export default {
  name: Events.GuildMemberRemove,
  async execute(member, client) {
    if (!isOurGuild(member.guild)) return;

    const user = member.user;
    if (user.bot) return;

    scheduleChartRefresh(client);
    const number = await getMemberNumber(member.guild.id, user.id);
    await markMemberLeft(member.guild.id, user.id);

    // ถ้าถูกเตะ จะมี audit log; ถ้าออกเอง จะไม่มี
    const kick = await findAuditEntry(member.guild, AuditLogEvent.MemberKick, user.id);

    const roles = member.roles?.cache
      ?.filter((r) => r.id !== member.guild.id)
      .map((r) => r.name)
      .join(', ');

    const embed = new EmbedBuilder()
      .setColor(kick ? COLORS.bad : COLORS.warn)
      .setTitle(kick ? '👢 สมาชิกถูกเตะ' : '📤 สมาชิกออกจากเซิร์ฟเวอร์')
      .setDescription(`${user} (${user.tag})`)
      .addFields(
        { name: 'ลำดับสมาชิก', value: number ? `#${number}` : '—', inline: true },
        { name: 'ยศที่มี', value: truncate(roles || 'ไม่มี'), inline: false },
      )
      .setFooter({ text: `ID: ${user.id}` });

    if (kick) {
      embed.addFields(
        { name: 'ผู้ดำเนินการ', value: describeExecutor(kick, client, 'kick', user.id), inline: true },
        { name: 'เหตุผล', value: truncate(kick.reason ?? 'ไม่ได้ระบุ'), inline: true },
      );
    }

    await sendLog(client, config.channels.member, embed);
  },
};
