import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { requireAdmin } from '../permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('แอดมินสมาชิก')
    .setDescription('สร้างแผงปุ่มสำหรับจัดการยศและสมาชิก'),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('👤 แผงควบคุม: จัดการสมาชิกและยศ')
      .setDescription('กดปุ่มด้านล่างเพื่อจัดการยศและข้อมูลสมาชิก:')
      .setFooter({ text: 'Member Management Panel • Fam System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_btn_roles')
        .setLabel('👤 จัดการยศสมาชิก')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('admin_btn_nickname')
        .setLabel('✏️ เปลี่ยนชื่อเล่น')
        .setStyle(ButtonStyle.Success),
    );

    await interaction.reply({ content: '✅ สร้างแผงปุ่มหมวดสมาชิกเรียบร้อย!', flags: MessageFlags.Ephemeral });
    await interaction.channel.send({ embeds: [embed], components: [row] });
  },
};