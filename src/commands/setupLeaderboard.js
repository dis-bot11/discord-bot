import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS } from '../logger.js';
import { activeSessions, DATA_PATH } from '../events/voiceStateUpdate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BOARD_CONFIG_PATH = path.join(__dirname, '../data/leaderboardConfig.json');

// ฟังก์ชันสร้างหน้าตา Embed (ดึงเวลาในไฟล์ + เวลาสดที่กำลังออนอยู่ตอนนี้)
export function generateLeaderboardEmbed() {
  let data = {};
  if (fs.existsSync(DATA_PATH)) {
    try {
      data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch {
      data = {};
    }
  }

  // ⏱️ นำเวลาในไฟล์ JSON มาบวกกับเวลาสดของคนที่กำลังนั่งอยู่ในห้องตอนนี้
  const combined = { ...data };
  const now = Date.now();
  for (const [userId, joinedAt] of activeSessions.entries()) {
    const liveMinutes = Math.floor((now - joinedAt) / 60000);
    combined[userId] = (combined[userId] || 0) + liveMinutes;
  }

  const sorted = Object.entries(combined)
    .filter(([, mins]) => mins > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20); // ดึงมา 20 อันดับ

  const rankList = sorted.length
    ? sorted
        .map(([id, m], idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
          return `${medal} <@${id}> — \`${Math.floor(m / 60)} ชม. ${m % 60} นาที\``;
        })
        .join('\n')
    : 'ยังไม่มีข้อมูลเวลาสะสมในระบบ';

  return new EmbedBuilder()
    .setColor(COLORS.info ?? '#3498DB')
    .setTitle('🏆 บอร์ดจัดอันดับคนออนห้องเสียงสูงสุด (Top 20)')
    .setDescription(rankList)
    .setFooter({ text: 'อัปเดตข้อมูลแบบเรียลไทม์อัตโนมัติ (ทุก 1 นาที)' })
    .setTimestamp();
}

export default {
  data: new SlashCommandBuilder()
    .setName('setup-leaderboard')
    .setDescription('สร้างบอร์ด 20 อันดับยอดออนห้องเสียงแบบอัปเดตอัตโนมัติในห้องนี้')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const message = await interaction.channel.send({ embeds: [generateLeaderboardEmbed()] });

    // บันทึกข้อมูลห้องและข้อความลงไฟล์ Config เผื่อบอทรีสตาร์ท
    const dir = path.dirname(BOARD_CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      BOARD_CONFIG_PATH,
      JSON.stringify({ channelId: interaction.channel.id, messageId: message.id }, null, 2)
    );

    await interaction.editReply({ content: '✅ สร้างบอร์ด 20 อันดับเรียบร้อยแล้ว บอทจะคอยอัปเดตข้อมูลแบบเรียลไทม์ทุกๆ 1 นาทีครับ' });
  },
};