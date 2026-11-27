import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS } from '../logger.js';
import supabase from '../utils/supabase.js'; // ปรับ path ตามโครงสร้างโปรเจกต์ของพี่

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BOARD_CONFIG_PATH = path.join(__dirname, '../data/leaderboardConfig.json');

// ☁️ ฟังก์ชันดึงและรวมยอดข้อมูลจากทั้ง 3 ตาราง (old + historical + current)
async function getCombinedVoiceTimes() {
  // ใช้ SQL Query ตรงเพื่อ FULL OUTER JOIN ทั้ง 3 ตาราง และบวกเวลารวมกันอย่างแม่นยำ
  const { data, error } = await supabase.rpc('get_combined_leaderboard');

  if (error) {
    console.error('Error fetching combined leaderboard via RPC, trying direct query/fallback:', error);
    
    // Fallback เผื่อไม่ได้สร้างฟังก์ชัน RPC ไว้ใน Supabase สามารถดึงผ่านคำสั่ง query ตรงได้ (ถ้า client รองรับ)
    // หรือใช้วิธีดึงข้อมูลแต่ละตารางมาเมิร์จในโค้ด Node.js ด้านล่างนี้ครับ
    const [oldRes, histRes, currRes] = await Promise.all([
      supabase.from('voice_times_old').select('user_id, minutes'),
      supabase.from('voice_times_historical').select('user_id, minutes'),
      supabase.from('voice_times').select('user_id, minutes')
    ]);

    const totals = {};

    const addData = (rows) => {
      if (!rows) return;
      for (const row of rows) {
        totals[row.user_id] = (totals[row.user_id] || 0) + (row.minutes || 0);
      }
    };

    addData(oldRes.data);
    addData(histRes.data);
    addData(currRes.data);

    return totals;
  }

  // แปลงข้อมูลจาก RPC ให้เป็น Object ในรูปแบบ { user_id: total_minutes }
  const result = {};
  if (data) {
    data.forEach(row => {
      result[row.user_id] = row.total_minutes;
    });
  }
  return result;
}

// 🏆 ฟังก์ชันสร้างหน้าตา Embed (ดึงเวลาล่าสุดที่รวม 3 ตารางมาจัดอันดับ)
export async function generateLeaderboardEmbed() {
  const data = await getCombinedVoiceTimes();

  const sorted = Object.entries(data)
    .filter(([, mins]) => mins > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20); // ดึงมาแสดง 20 อันดับแรก

  const rankList = sorted.length
    ? sorted
        .map(([id, m], idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
          return `${medal} <@${id}> — \`${Math.floor(m / 60)} ชม. ${m % 60} นาที\`;`;
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