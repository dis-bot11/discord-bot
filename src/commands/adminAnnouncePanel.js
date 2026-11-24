import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../logger.js';
import { requireAdmin } from '../permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('แอดมินประกาศ')
    .setDescription('สร้างแผงปุ่มสำหรับหมวดประกาศและแจ้งเตือน'),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('📢 แผงควบคุม: ประกาศและแจ้งเตือน')
      .setDescription('กดปุ่มด้านล่างเพื่อเลือกใช้งานระบบประกาศของแฟม:')
      .setFooter({ text: 'Announce Panel • Fam System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_btn_announce')
        .setLabel('📢 ส่งประกาศแฟม')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_btn_notice')
        .setLabel('🔔 แจ้งเตือนล่วงหน้า')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ content: '✅ สร้างแผงปุ่มหมวดประกาศเรียบร้อย!', flags: MessageFlags.Ephemeral });
    await interaction.channel.send({ embeds: [embed], components: [row] });
  },
};