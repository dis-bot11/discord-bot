import { AuditLogEvent, EmbedBuilder, Events, PermissionsBitField } from 'discord.js';
import { config } from '../config.js';
import { scheduleChartRefresh } from '../chart.js';
import { COLORS, findAuditEntry, isOurGuild, sendLog, truncate, when } from '../logger.js';

const names = (bits) => new PermissionsBitField(bits).toArray().join(', ');

export default {
  name: Events.GuildRoleUpdate,
  async execute(oldRole, newRole, client) {
    if (!isOurGuild(newRole.guild)) return;

    const changes = [];
    if (oldRole.name !== newRole.name) {
      changes.push(`ชื่อ: ${oldRole.name} ➜ ${newRole.name}`);
      scheduleChartRefresh(client); // ชื่อยศเปลี่ยน ผังแฟมต้องอัปเดตตาม
    }
    if (oldRole.color !== newRole.color) changes.push('สีของยศเปลี่ยน');
    if (oldRole.hoist !== newRole.hoist) changes.push(`แยกแสดงสมาชิก: ${oldRole.hoist ? 'เปิด' : 'ปิด'} ➜ ${newRole.hoist ? 'เปิด' : 'ปิด'}`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`ให้แท็กได้: ${oldRole.mentionable ? 'ใช่' : 'ไม่'} ➜ ${newRole.mentionable ? 'ใช่' : 'ไม่'}`);

    const added = newRole.permissions.bitfield & ~oldRole.permissions.bitfield;
    const removed = oldRole.permissions.bitfield & ~newRole.permissions.bitfield;
    if (added) changes.push(`✅ สิทธิ์ที่เพิ่ม: ${names(added)}`);
    if (removed) changes.push(`⛔ สิทธิ์ที่ถอน: ${names(removed)}`);

    // ไม่ log การลากย้ายลำดับยศ (position) เพราะเกิด event ทีละหลายยศ
    if (changes.length === 0) return;

    const entry = await findAuditEntry(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    await sendLog(
      client,
      config.channels.mod,
      new EmbedBuilder()
        .setColor(added || removed ? COLORS.bad : COLORS.warn)
        .setTitle(added || removed ? '🔐 เปลี่ยนสิทธิ์ของยศ' : '⚙️ แก้ไขยศ')
        .addFields(
          { name: 'ยศ', value: `${newRole} (${newRole.name})`, inline: true },
          { name: 'ผู้ดำเนินการ', value: entry?.executor ? `${entry.executor}` : 'ไม่ทราบ', inline: true },
          { name: 'การเปลี่ยนแปลง', value: truncate(changes.join('\n')) },
          { name: 'เวลา', value: when() },
        )
        .setFooter({ text: `ID: ${newRole.id}` }),
    );
  },
};
