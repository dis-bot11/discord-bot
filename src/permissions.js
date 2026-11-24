import { MessageFlags } from 'discord.js';
import { config } from './config.js';

// กำหนด User ID ของผู้ดูแลระบบที่มีสิทธิ์ขาด (2 คนตามที่กำหนด)
const ALLOWED_ADMIN_IDS = [
  '1573261820842741790',
  '1459481860626190568'
];

/** ผู้ดูแล = เจ้าของเซิร์ฟเวอร์ หรืออยู่ในรายชื่อ ID ที่กำหนด */
export function isAdmin(member) {
  if (!member) return false;
  // อนุญาตให้ User ID ที่ระบุไว้ หรือเจ้าของเซิร์ฟเวอร์ใช้งานได้
  if (ALLOWED_ADMIN_IDS.includes(member.id)) return true;
  if (member.guild.ownerId === member.id) return true;
  
  return member.roles.cache.some((role) => config.adminRoleIds.has(role.id));
}

/** ถ้าไม่ใช่ผู้ดูแล ตอบปฏิเสธเฉพาะคนสั่ง แล้วคืน false */
export async function requireAdmin(interaction) {
  if (isAdmin(interaction.member)) return true;
  await interaction.reply({
    content: '⛔ คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลแฟมเท่านั้น',
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

/**
- ตรวจว่าลงโทษคนนี้ได้ไหม คืนข้อความ error หรือ null ถ้าผ่าน
- kind: 'warn' (ตรวจแค่ลำดับยศ) | 'timeout' | 'kick' | 'ban'
 */
export function checkTarget(guild, invokerMember, targetMember, kind) {
  if (!targetMember) return null; // ไม่อยู่ในเซิร์ฟเวอร์แล้ว (ใช้กับแบนได้)
  if (targetMember.id === invokerMember.id) return 'ลงโทษตัวเองไม่ได้';
  if (targetMember.id === guild.ownerId) return 'ลงโทษเจ้าของเซิร์ฟเวอร์ไม่ได้';
  if (
    invokerMember.id !== guild.ownerId &&
    targetMember.roles.highest.position >= invokerMember.roles.highest.position
  ) {
    return 'เป้าหมายมียศสูงกว่าหรือเท่ากับคุณ';
  }
  if (kind === 'ban' && !targetMember.bannable) {
    return 'บอทแบนคนนี้ไม่ได้ (ยศบอทต้องสูงกว่าเป้าหมาย และบอทต้องมีสิทธิ์ Ban Members)';
  }
  if (kind === 'kick' && !targetMember.kickable) {
    return 'บอทเตะคนนี้ไม่ได้ (ยศบอทต้องสูงกว่าเป้าหมาย และบอทต้องมีสิทธิ์ Kick Members)';
  }
  if (kind === 'timeout' && !targetMember.moderatable) {
    return 'บอท Timeout คนนี้ไม่ได้ (ยศบอทต้องสูงกว่าเป้าหมาย และบอทต้องมีสิทธิ์ Moderate Members)';
  }
  return null;
}

/** หาห้องปลายทางสำหรับโพสต์: ใช้ห้องที่ตั้งค่าไว้ ถ้าไม่มี/เข้าไม่ได้ ใช้ห้องที่พิมพ์คำสั่ง */
export async function resolveTargetChannel(client, channelId, fallback) {
  if (!channelId) return fallback;
  try {
    const channel = await client.channels.fetch(channelId);
    return channel?.isTextBased() ? channel : fallback;
  } catch {
    return fallback;
  }
}