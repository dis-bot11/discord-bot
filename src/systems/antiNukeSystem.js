import { AuditLogEvent, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// 📌 ตัวแปรเปิด/ปิดระบบกันบอท (ค่าเริ่มต้นเป็น true คือเปิดใช้งาน)
let isBotGuardActive = true;

export function setBotGuardStatus(status) {
  isBotGuardActive = status;
}

export function getBotGuardStatus() {
  return isBotGuardActive;
}

// 📌 ใส่ ID ของบอทที่อนุญาตให้อยู่ในเซิร์ฟเวอร์
const WHITELIST_BOTS = [
  '1035855730978324492', // ตัวอย่าง ID บอทหลัก
];

const ALERT_CHANNEL_ID = '';
const actionTracker = new Map();

async function sendSecurityAlert(guild, title, description) {
  const logChannel = (ALERT_CHANNEL_ID ? guild.channels.cache.get(ALERT_CHANNEL_ID) : null) ||
                     guild.channels.cache.find(c => c.name === 'log-แอดมิน');
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle(`🚨 [SECURITY ALERT] ${title}`)
    .setDescription(description)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

// 1. ตรวจจับเมื่อมีบอทตัวใหม่เข้าเซิร์ฟเวอร์ (เช็กสถานะเปิด/ปิดที่นี่)
export async function handleBotJoinGuard(member) {
  if (!member.user.bot) return;
  
  // 🛑 ถ้าปิดสวิตช์ระบบกันบอทอยู่ จะปล่อยให้เข้าได้เลย
  if (!isBotGuardActive) {
    console.log(`ℹ️ ระบบกันบอทถูกปิดชั่วคราว อนุญาตให้ดึงบอท ${member.user.tag} เข้ามาได้`);
    return;
  }

  if (WHITELIST_BOTS.includes(member.id)) return;

  try {
    await member.kick('ระบบป้องกัน: ไม่อนุญาตให้นำบอทนอกเหนือจาก Whitelist เข้าเซิร์ฟเวอร์');
    await sendSecurityAlert(
      member.guild,
      'สกัดกั้นบอทแปลกปลอมสำเร็จ',
      `พบการดึงบอท **${member.user.tag}** (\`${member.id}\`) เข้าเซิร์ฟเวอร์โดยไม่ได้รับอนุญาต ระบบได้ทำการเตะออกอัตโนมัติเรียบร้อยแล้ว`
    );
  } catch (err) {
    console.error('[Anti-Nuke] เตะบอทแปลกปลอมไม่สำเร็จ:', err);
  }
}

// 2. ฟังก์ชันตรวจสอบ Audit Log (เหมือนเดิม)
export async function monitorBotActions(guild, actionType) {
  try {
    const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: actionType });
    const entry = auditLogs.entries.first();
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (!executor.bot || executor.id === guild.client.user.id) return;

    const now = Date.now();
    const record = actionTracker.get(executor.id) || { count: 0, firstActionTime: now };

    if (now - record.firstActionTime > 10000) {
      record.count = 1;
      record.firstActionTime = now;
    } else {
      record.count += 1;
    }

    actionTracker.set(executor.id, record);

    if (record.count >= 2) {
      const botMember = await guild.members.fetch(executor.id).catch(() => null);
      if (botMember && botMember.bannable) {
        await botMember.ban({ reason: 'Anti-Nuke: ตรวจพบพฤติกรรมลบห้องหรือยศรัวผิดปกติ' });
        await sendSecurityAlert(
          guild,
          'ระงับบอทคลั่ง (Anti-Nuke Triggered)',
          `บอท **${executor.tag}** (\`${executor.id}\`) พยายามลบข้อมูลเซิร์ฟเวอร์รัวเกินกำหนด ระบบได้ทำการ **แบนถาวร** เรียบร้อยแล้ว`
        );
      }
      actionTracker.delete(executor.id);
    }
  } catch (err) {
    console.error('[Anti-Nuke] ตรวจสอบ Audit Log ผิดพลาด:', err);
  }
}