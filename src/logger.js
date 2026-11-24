import { config } from './config.js';
import { takeAction } from './state.js';

export const COLORS = {
  info: 0x5865f2,
  good: 0x57f287,
  warn: 0xfee75c,
  bad: 0xed4245,
};

/** ตัดข้อความให้ไม่เกินลิมิตของ embed */
export function truncate(text, max = 1000) {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** แสดงเวลาแบบ Discord (เห็นเป็นเวลาท้องถิ่นของแต่ละคน) เช่น "19 พฤศจิกายน 2569 14:30 (2 นาทีที่แล้ว)" */
export function when(ms = Date.now()) {
  const s = Math.floor(ms / 1000);
  return `<t:${s}:F> (<t:${s}:R>)`;
}

/** แปลงมิลลิวินาทีเป็นข้อความไทย เช่น "1 ชม. 30 นาที" */
export function formatDuration(ms) {
  const totalMin = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts = [];
  if (d) parts.push(`${d} วัน`);
  if (h) parts.push(`${h} ชม.`);
  if (m) parts.push(`${m} นาที`);
  return parts.join(' ') || '1 นาที';
}

/** เช็คว่า event มาจากเซิร์ฟเวอร์ของเราเท่านั้น (กันบอทถูกเชิญไปที่อื่นแล้ว log มั่ว) */
export function isOurGuild(guild) {
  return guild?.id === config.guildId;
}

/** ส่ง embed ไปห้อง log; ถ้าไม่ได้ตั้งห้อง หรือส่งไม่ได้ จะไม่ทำให้บอทล่ม */
export async function sendLog(client, channelId, embed) {
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      await channel.send({ embeds: [embed.setTimestamp()] });
    }
  } catch (error) {
    console.error(`[log] ส่งไปห้อง ${channelId} ไม่สำเร็จ:`, error.message);
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchAudit(guild, type, targetId, predicate = () => true) {
  const logs = await guild.fetchAuditLogs({ type, limit: 8 });
  return (
    logs.entries.find(
      (entry) =>
        entry.target?.id === targetId &&
        Date.now() - entry.createdTimestamp < 15000 &&
        predicate(entry),
    ) ?? null
  );
}

/**
 * หาว่าใครเป็นคนทำ action จาก Audit Log (ต้องให้สิทธิ์ View Audit Log)
 * - types ส่งเป็นชนิดเดียวหรือหลายชนิด (array) ก็ได้
 * - เลือกเฉพาะรายการที่ target ตรงกับคนที่ถูกกระทำ และเกิดภายใน 15 วินาที
 * - predicate ใช้กรองเพิ่ม เช่น ต้องเป็นรายการที่เปลี่ยนค่า "mute"
 * หน่วงเล็กน้อยเพราะ Discord เขียน audit log ช้ากว่า event นิดหน่อย
 */
export async function findAuditEntry(guild, types, targetId, predicate = () => true) {
  try {
    await wait(1200);
    for (const type of [].concat(types)) {
      const logs = await guild.fetchAuditLogs({ type, limit: 8 });
      const hit = logs.entries.find(
        (entry) =>
          entry.target?.id === targetId &&
          Date.now() - entry.createdTimestamp < 15000 &&
          predicate(entry),
      );
      if (hit) return hit;
    }
    return null;
  } catch {
    return null;
  }
}

/** เหมือนด้านบน แต่ไม่เช็ก target (ใช้กับ action ที่ Discord ไม่บันทึกเป้าหมาย เช่น ตัดการเชื่อมต่อห้องเสียง) */
export async function findRecentAuditEntry(guild, type) {
  try {
    await wait(1200);
    const logs = await guild.fetchAuditLogs({ type, limit: 8 });
    return logs.entries.find((entry) => Date.now() - entry.createdTimestamp < 10000) ?? null;
  } catch {
    return null;
  }
}

// กัน audit entry เดียวถูกอ้างว่าเป็นของหลายคนเกินจำนวนที่ Discord บันทึก (count)
const attributed = new Map();
export function claimEntry(entry, maxUses = 1) {
  const used = attributed.get(entry.id) ?? 0;
  if (used >= maxUses) return false;
  attributed.set(entry.id, used + 1);
  if (attributed.size > 500) attributed.delete(attributed.keys().next().value);
  return true;
}

/** ค้น audit log หลายชนิดพร้อมกัน (เช่น แก้สิทธิ์ห้อง = overwrite create/update/delete) */
export const findAuditEntryAny = findAuditEntry;

/**
 * ข้อความ "ผู้ดำเนินการ" สำหรับ log
 * ถ้าผู้ทำใน Audit Log คือตัวบอทเอง (เพราะแอดมินสั่งผ่านคำสั่งบอท) จะแสดงชื่อแอดมินตัวจริงแทน
 */
export function describeExecutor(entry, client, type, targetId) {
  const executor = entry?.executor ?? null;
  if (!executor || executor.id === client.user.id) {
    const action = takeAction(type, targetId);
    if (action) return `<@${action.adminId}> (สั่งผ่านบอท)`;
  }
  return executor ? `${executor}` : 'ไม่ทราบ';
}
