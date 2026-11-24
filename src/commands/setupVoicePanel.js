import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { COLORS } from '../logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup-voicepanel')
    .setDescription('สร้างแผงปุ่มกดเช็กเวลาออนห้องเสียงในห้องนี้')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('🎙️ ระบบตรวจสอบเวลาออนห้องเสียง & รับยศอัตโนมัติ')
      .setDescription(
        'สะสมเวลาออนไลน์ในห้องเสียง (ไม่นับห้อง AFK) เพื่อรับยศพิเศษอัตโนมัติ:\n\n' +
        '🥉 **ครบ 50 ชั่วโมง** — รับยศระดับที่ 1\n' +
        '🥈 **ครบ 100 ชั่วโมง** — รับยศระดับที่ 2\n' +
        '🥇 **ครบ 250 ชั่วโมง** — รับยศระดับที่ 3\n' +
        '👑 **ครบ 500 ชั่วโมง** — รับยศระดับสูงสุด\n\n' +
        'กดปุ่มด้านล่างเพื่อประกาศเช็กเวลาสะสมของตัวเอง หรือดูอันดับสูงสุดในเซิร์ฟเวอร์'
      )
      .setFooter({ text: 'ระบบจะอัปเดตและแจกยศให้อัตโนมัติเมื่อออกจากห้องเสียง' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_check_voicetime')
        .setLabel('⏱️ เช็กเวลาของฉัน')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_voice_leaderboard')
        .setLabel('🏆 ดู 10 อันดับสูงสุด')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ สร้างแผงปุ่มเช็กเวลาเรียบร้อยแล้วครับ', ephemeral: true });
  },
};