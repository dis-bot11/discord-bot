import { AuditLogEvent, EmbedBuilder, Events, OverwriteType, PermissionsBitField } from 'discord.js';
import { config } from '../config.js';
import { COLORS, findAuditEntryAny, isOurGuild, sendLog, truncate, when } from '../logger.js';

const names = (bits) => new PermissionsBitField(bits).toArray().join(', ');

/** เทียบสิทธิ์รายยศ/รายคนของห้อง (permission overwrites) ก่อน-หลัง */
function diffOverwrites(oldChannel, newChannel) {
  const lines = [];
  const oldOw = oldChannel.permissionOverwrites?.cache;
  const newOw = newChannel.permissionOverwrites?.cache;
  if (!oldOw || !newOw) return lines;

  for (const id of new Set([...oldOw.keys(), ...newOw.keys()])) {
    const before = oldOw.get(id);
    const after = newOw.get(id);
    const ref = after ?? before;
    const who =
      id === newChannel.guild.id ? '@everyone' : ref.type === OverwriteType.Role ? `<@&${id}>` : `<@${id}>`;

    if (!before) {
      lines.push(`➕ ${who}: เพิ่มการตั้งสิทธิ์${after.allow.bitfield ? ` | อนุญาต: ${names(after.allow.bitfield)}` : ''}${after.deny.bitfield ? ` | ปฏิเสธ: ${names(after.deny.bitfield)}` : ''}`);
    } else if (!after) {
      lines.push(`➖ ${who}: ลบการตั้งสิทธิ์`);
    } else {
      const allowOn = after.allow.bitfield & ~before.allow.bitfield;
      const allowOff = before.allow.bitfield & ~after.allow.bitfield;
      const denyOn = after.deny.bitfield & ~before.deny.bitfield;
      const denyOff = before.deny.bitfield & ~after.deny.bitfield;
      const parts = [];
      if (allowOn) parts.push(`✅ อนุญาตเพิ่ม: ${names(allowOn)}`);
      if (allowOff) parts.push(`⬜ เลิกอนุญาต: ${names(allowOff)}`);
      if (denyOn) parts.push(`⛔ ปฏิเสธเพิ่ม: ${names(denyOn)}`);
      if (denyOff) parts.push(`⬜ เลิกปฏิเสธ: ${names(denyOff)}`);
      if (parts.length) lines.push(`✏️ ${who}: ${parts.join(' | ')}`);
    }
  }
  return lines;
}

export default {
  name: Events.ChannelUpdate,
  async execute(oldChannel, newChannel, client) {
    if (!newChannel.guild || !isOurGuild(newChannel.guild)) return;

    // ไม่ log การลากย้ายตำแหน่งห้อง (position) เพราะทำให้เกิด event ทีละหลายห้อง
    const changes = [];
    if (oldChannel.name !== newChannel.name) changes.push(`ชื่อ: ${oldChannel.name} ➜ ${newChannel.name}`);
    if (oldChannel.parentId !== newChannel.parentId) {
      changes.push(`หมวดหมู่: ${oldChannel.parent?.name ?? 'ไม่มี'} ➜ ${newChannel.parent?.name ?? 'ไม่มี'}`);
    }
    if (oldChannel.topic !== newChannel.topic) changes.push('หัวข้อห้อง (topic) ถูกแก้ไข');
    if (oldChannel.nsfw !== newChannel.nsfw) changes.push(`NSFW: ${oldChannel.nsfw ? 'เปิด' : 'ปิด'} ➜ ${newChannel.nsfw ? 'เปิด' : 'ปิด'}`);

    const permLines = diffOverwrites(oldChannel, newChannel);
    if (changes.length === 0 && permLines.length === 0) return;

    const entry = await findAuditEntryAny(
      newChannel.guild,
      permLines.length
        ? [AuditLogEvent.ChannelOverwriteUpdate, AuditLogEvent.ChannelOverwriteCreate, AuditLogEvent.ChannelOverwriteDelete, AuditLogEvent.ChannelUpdate]
        : [AuditLogEvent.ChannelUpdate],
      newChannel.id,
    );

    const embed = new EmbedBuilder()
      .setColor(COLORS.warn)
      .setTitle(permLines.length ? '🔐 เปลี่ยนสิทธิ์/ตั้งค่าห้อง' : '⚙️ แก้ไขห้อง')
      .addFields(
        { name: 'ห้อง', value: `<#${newChannel.id}> (${newChannel.name})`, inline: true },
        { name: 'ผู้ดำเนินการ', value: entry?.executor ? `${entry.executor}` : 'ไม่ทราบ', inline: true },
      )
      .setFooter({ text: `ID: ${newChannel.id}` });

    if (changes.length) embed.addFields({ name: 'การเปลี่ยนแปลง', value: truncate(changes.join('\n')) });
    if (permLines.length) {
      const shown = permLines.slice(0, 8);
      const more = permLines.length > shown.length ? `\n…และอีก ${permLines.length - shown.length} รายการ` : '';
      embed.addFields({ name: 'สิทธิ์', value: truncate(shown.join('\n') + more) });
    }
    embed.addFields({ name: 'เวลา', value: when() });

    await sendLog(client, config.channels.mod, embed);
  },
};
