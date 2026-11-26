import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../logger.js';
import { getVoiceTimes } from '../utils/supabase.js';

export default {
  data: new SlashCommandBuilder()
    .setName('voicetime')
    .setDescription('เช็กเวลาสะสมในห้องเสียงและอันดับยอดออนสูงสุด')
    .addUserOption((option) =>
      option.setName('target').setDescription('ดูเวลาของสมาชิกคนอื่น (เว้นว่างไว้เพื่อดูของตัวเอง)').setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const targetUser = interaction.options.getUser('target') || interaction.user;
    
    // ☁️ ดึงข้อมูลเวลาทั้งหมดจาก Supabase
    const data = await getVoiceTimes();

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