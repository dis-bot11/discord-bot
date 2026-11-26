import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data/voiceTime.json');

// 🎯 ฟังก์ชันตรวจสอบและแจกยศ 50 ชั่วโมงจากไฟล์ JSON โดยตรง
async function checkAndAssignVoiceRoleFromJson(guild) {
  try {
    if (!fs.existsSync(DATA_PATH)) return;
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

    // ID ยศ 50 ชั่วโมง (เปลี่ยนเป็น ID จริงของเซิร์ฟเวอร์พี่ได้เลยครับ)
    const ROLE_50_HOURS_ID = 'ใส่_ID_ยศ_50_ชั่วโมง_ตรงนี้';

    for (const [userId, minutes] of Object.entries(data)) {
      const hours = minutes / 60;

      if (hours >= 50) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) continue;

        if (!member.roles.cache.has(ROLE_50_HOURS_ID)) {
          await member.roles.add(ROLE_50_HOURS_ID).catch((err) => {
            console.error(`[Voice Role] แจกยศ 50 ชม. ให้ ${member.user.tag} ไม่สำเร็จ:`, err);
          });
          console.log(`[Voice Role] 🎯 แจกยศ 50 ชั่วโมง ให้กับ ${member.user.tag} (${hours.toFixed(1)} ชม.) สำเร็จ!`);
        }
      }
    }
  } catch (err) {
    console.error('[Voice Role Error] เกิดข้อผิดพลาดในการแจกยศจาก JSON:', err);
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('voicetime')
    .setDescription('เช็กเวลาสะสมในห้องเสียงและอันดับยอดออนสูงสุด')
    .addUserOption((option) =>
      option.setName('target').setDescription('ดูเวลาของสมาชิกคนอื่น (เว้นว่างไว้เพื่อดูของตัวเอง)').setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    // ทุกครั้งที่มีคนพิมพ์ /voicetime ให้ระบบช่วยเช็กและแจกยศรอบนึงทันทีด้วย
    await checkAndAssignVoiceRoleFromJson(interaction.guild);

    const targetUser = interaction.options.getUser('target') || interaction.user;
    
    let data = {};
    if (fs.existsSync(DATA_PATH)) {
      try {
        data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      } catch {
        data = {};
      }
    }

    const userMinutes = data[targetUser.id] || 0;
    const totalHours = (userMinutes / 60).toFixed(1);

    // จัดอันดับ Leaderboard (Top 10)
    const sortedUsers = Object.entries(data)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    let rankText = '';
    let index = 1;
    for (const [id, mins] of sortedUsers) {
      const hours = (mins / 60).toFixed(1);
      rankText += `**#${index}** <@${id}> — \`${hours} ชม.\`\n`;
      index++;
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('🎙️ สถิติเวลาออนห้องเสียง')
      .setDescription(`สถิติของ **${targetUser.tag}**\n⏱️ เวลาสะสมทั้งหมด: **${totalHours} ชั่วโมง** (${userMinutes} นาที)`)
      .addFields({
        name: '🏆 10 อันดับยอดออนสูงสุดในเซิร์ฟเวอร์',
        value: rankText || 'ยังไม่มีข้อมูลอันดับ',
        inline: false,
      })
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [embed] });
  },
};