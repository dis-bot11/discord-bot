import { AuditLogEvent, EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import { scheduleChartRefresh } from '../chart.js';
import { COLORS, describeExecutor, findAuditEntry, formatDuration, isOurGuild, sendLog, truncate, when } from '../logger.js';

export default {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember, client) {
    if (!isOurGuild(newMember.guild)) return;
    if (newMember.user.bot) return;

    // ถ้าข้อมูลเก่าไม่อยู่ในแคช (partial) จะเทียบความต่างไม่ได้
    if (oldMember.partial) return;

    const user = newMember.user;

    // เปลี่ยนชื่อเล่น
    if (oldMember.nickname !== newMember.nickname) {
      const entry = await findAuditEntry(newMember.guild, AuditLogEvent.MemberUpdate, user.id, (e) =>
        e.changes?.some((c) => c.key === 'nick'),
      );
      await sendLog(
        client,
        config.channels.member,
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle('✏️ เปลี่ยนชื่อเล่น')
          .setDescription(`${user} (${user.tag})`)
          .addFields(
            { name: 'ก่อน', value: oldMember.nickname ?? '(ไม่มี)', inline: true },
            { name: 'หลัง', value: newMember.nickname ?? '(ไม่มี)', inline: true },
            { name: 'ผู้ดำเนินการ', value: entry?.executor ? `${entry.executor}` : 'ไม่ทราบ', inline: true },
          )
          .setFooter({ text: `ID: ${user.id}` }),
      );
    }

    // เปลี่ยนยศ
    const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
    const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));

    if (added.size > 0 || removed.size > 0) {
      scheduleChartRefresh(client);
      const entry = await findAuditEntry(newMember.guild, AuditLogEvent.MemberRoleUpdate, user.id);
      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('🏷️ เปลี่ยนยศสมาชิก')
        .setDescription(`${user} (${user.tag})`)
        .addFields({
          name: 'ผู้ดำเนินการ',
          value: entry?.executor ? `${entry.executor}` : 'ไม่ทราบ',
          inline: true,
        })
        .setFooter({ text: `ID: ${user.id}` });

      if (added.size > 0) {
        embed.addFields({ name: '➕ ได้รับยศ', value: added.map((r) => `${r}`).join(', ') });
      }
      if (removed.size > 0) {
        embed.addFields({ name: '➖ ถูกถอดยศ', value: removed.map((r) => `${r}`).join(', ') });
      }

      await sendLog(client, config.channels.member, embed);
    }

    // Timeout (หมดเวลา) ถูกตั้ง / แก้ไข / ยกเลิก
    // หมายเหตุ: Discord ไม่ส่ง event ตอน timeout หมดอายุเอง จึง log ได้เฉพาะตอนตั้งและตอนยกเลิกก่อนเวลา
    const now = Date.now();
    const oldTs = oldMember.communicationDisabledUntilTimestamp;
    const newTs = newMember.communicationDisabledUntilTimestamp;
    const oldActive = Boolean(oldTs && oldTs > now);
    const newActive = Boolean(newTs && newTs > now);

    if ((newActive && newTs !== oldTs) || (oldActive && !newActive)) {
      const entry = await findAuditEntry(newMember.guild, AuditLogEvent.MemberUpdate, user.id, (e) =>
        e.changes?.some((c) => c.key === 'communication_disabled_until'),
      );

      const embed = new EmbedBuilder()
        .setColor(newActive ? COLORS.bad : COLORS.good)
        .setTitle(
          newActive
            ? oldActive
              ? '⏳ แก้ไขเวลา Timeout'
              : '⏳ สมาชิกถูก Timeout (หมดเวลา)'
            : '✅ ยกเลิก Timeout ก่อนเวลา',
        )
        .addFields(
          { name: 'ผู้ถูกกระทำ', value: `${user} (${user.tag})`, inline: true },
          { name: 'ผู้ดำเนินการ', value: describeExecutor(entry, client, 'timeout', user.id), inline: true },
        )
        .setFooter({ text: `ID: ${user.id}` });

      if (newActive) {
        embed.addFields(
          { name: 'ระยะเวลา', value: formatDuration(newTs - now), inline: true },
          { name: 'ครบกำหนด', value: when(newTs) },
        );
      }
      embed.addFields(
        { name: 'เหตุผล', value: truncate(entry?.reason ?? 'ไม่ได้ระบุ') },
        { name: 'เวลาที่ทำรายการ', value: when(now) },
      );

      await sendLog(client, config.channels.mod, embed);
    }
  },
};
