import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS } from '../logger.js';
import { activeSessions, DATA_PATH } from '../events/voiceStateUpdate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BOARD_CONFIG_PATH = path.join(__dirname, '../data/leaderboardConfig.json');

// ฟังก์ชันสร้างหน้าตา Embed (ดึงเวลาในไฟล์ที่เป็นชั่วโมง + เวลาสด)
export function generateLeaderboardEmbed() {
  let data = {};
  if (fs.existsSync(DATA_PATH)) {
    try {
      data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch {
      data = {};
    }
  }

  // ⏱️ นำเวลาในไฟล์ JSON (หน่วยเป็นชั่วโมง) มาบวกกับเวลาสดที่กำลังออนอยู่ (แปลงนาทีเป็นชั่วโมง)
  const combined = { ...data };
  const now = Date.now();
  for (const [userId, joinedAt] of activeSessions.entries()) {
    const liveHours = (now - joinedAt) / (1000 * 60 * 60); // แปลงมิลลิวินาทีเป็นชั่วโมง
    combined[userId] = (combined[userId] || 0) + liveHours;
  }

  const sorted = Object.entries(combined)
    .filter(([, hours]) => hours > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20); // ดึงมา 20 อันดับ

  const rankList = sorted.length
    ? sorted
        .map(([id, totalHours], idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
          const hrs = Math.floor(totalHours);
          const mins = Math.floor((totalHours - hrs) * 60);
          return `${medal} <@${id}> — \`${hrs} ชม. ${mins} นาที\``;
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

    const dir = path.dirname(BOARD_CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      BOARD_CONFIG_PATH,
      JSON.stringify({ channelId: interaction.channel.id, messageId: message.id }, null, 2)
    );

    await interaction.editReply({ content: '✅ สร้างบอร์ด 20 อันดับเรียบร้อยแล้ว บอทจะคอยอัปเดตข้อมูลแบบเรียลไทม์ทุกๆ 1 นาทีครับ' });
  },
};