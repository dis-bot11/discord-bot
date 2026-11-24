import { EmbedBuilder, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getModerationPanelComponents } from '../systems/moderationSystem.js';
import { requireAdmin } from '../permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('แอดมินลงโทษ')
    .setDescription('สร้างแผงปุ่มกดระบบลงโทษสมาชิก (สำหรับแอดมิน)'),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('⚖️ แผงควบคุมระบบลงโทษสมาชิก - มาดามของเหล่าสตรี')
      .setDescription('คลิกปุ่มด้านล่างเพื่อเลือกกระบวนการลงโทษตามระดับความผิด ระบบจะบันทึก Log และจัดการยศให้อัตโนมัติ:')
      .setFooter({ text: 'Moderation Control Panel • Fam System' });

    await interaction.reply({ content: '✅ สร้างแผงปุ่มลงโทษเรียบร้อย!', flags: MessageFlags.Ephemeral });
    await interaction.channel.send({ embeds: [embed], components: getModerationPanelComponents() });
  },
};