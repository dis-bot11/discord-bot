import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { requireAdmin } from '../permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('แอดมินความปลอดภัย')
    .setDescription('สร้างแผงปุ่มสำหรับระบบความปลอดภัยและประวัติโทษ'),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🛡️ แผงควบคุม: ความปลอดภัยและประวัติ')
      .setDescription('กดปุ่มด้านล่างเพื่อตรวจสอบสถานะหรือดูประวัติโทษ:')
      .setFooter({ text: 'Security & History Panel • Fam System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_btn_status')
        .setLabel('🤖 เช็กสถานะบอท')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_btn_history')
        .setLabel('📜 ตรวจประวัติโทษ')
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ content: '✅ สร้างแผงปุ่มหมวดความปลอดภัยเรียบร้อย!', flags: MessageFlags.Ephemeral });
    await interaction.channel.send({ embeds: [embed], components: [row] });
  },
};