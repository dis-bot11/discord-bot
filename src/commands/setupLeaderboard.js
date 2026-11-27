import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS } from '../logger.js';
import { supabase } from '../utils/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BOARD_CONFIG_PATH = path.join(__dirname, '../data/leaderboardConfig.json');

// ☁️ ฟังก์ชันดึงและรวมยอดข้อมูล พร้อมใส่ Debug ดูข้อมูลดิบ
async function getCombinedVoiceTimes() {
  try {
    const [oldRes, histRes, currRes] = await Promise.all([
      supabase.from('voice_times_old').select('user_id, minutes'),
      supabase.from('voice_times_historical').select('user_id, minutes'),
      supabase.from('voice_times').select('user_id, minutes')
    ]);

    // 🔍 [DEBUG] เช็กข้อมูลที่ดึงมาจากแต่ละตารางใน Terminal
    console.log('--- [DEBUG LEADERBOARD] ---');
    console.log('1. voice_times_old:', oldRes.data);
    console.log('2. voice_times_historical:', histRes.data);
    console.log('3. voice_times:', currRes.data);

    const totals = {};
    const addData = (rows) => {
      if (!rows) return;
      for (const row of rows) {
        if (!row.user_id) continue;
        totals[row.user_id] = (totals[row.user_id] || 0) + (row.minutes || 0);
      }
    };

    addData(oldRes.data);
    addData(histRes.data);
    addData(currRes.data);

    console.log('Final Combined Totals:', totals);
    console.log('---------------------------');

    return totals;
  } catch (error) {
    console.error('Error fetching combined voice times:', error);
    return {};
  }
}

// 🏆 ฟังก์ชันสร้างหน้าตา Embed
export async function generateLeaderboardEmbed() {
  const data = await getCombinedVoiceTimes();

  const sorted = Object.entries(data)
    .filter(([, mins]) => mins > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

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

    const embed = await generateLeaderboardEmbed();
    const message = await interaction.channel.send({ embeds: [embed] });

    const dir = path.dirname(BOARD_CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      BOARD_CONFIG_PATH,
      JSON.stringify({ channelId: interaction.channel.id, messageId: message.id }, null, 2)
    );

    await interaction.editReply({ content: '✅ สร้างบอร์ด 20 อันดับเรียบร้อยแล้ว บอทจะคอยอัปเดตข้อมูลแบบเรียลไทม์ทุกๆ 1 นาทีครับ' });
  },
};