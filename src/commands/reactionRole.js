import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../logger.js';
import { requireAdmin } from '../permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ตั้งปุ่มรับยศ')
    .setDescription('โพสต์ปุ่มรับยศเพื่อเปิดห้องทั้งหมด (เฉพาะแอดมินแฟมเท่านั้น)')
    .addRoleOption((option) =>
      option.setName('yot').setDescription('เลือกยศที่จะได้รับเมื่อกดปุ่ม (เช่น ยศ member)').setRequired(true),
    ),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const role = interaction.options.getRole('yot');

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('🌸 ปลดล็อกห้องทั้งหมด - ราเซีย')
      .setDescription(`กดปุ่มด้านล่างเพื่อรับยศ **${role.name}** และเปิดมองเห็นห้องทั้งหมดในแฟมค่ะ!`)
      .setImage('https://cdn.discordapp.com/attachments/1573529871672418415/1573531151115751454/13F568BE-ED28-42A0-A17B-78BAF8EB91E6.jpg') // รูปธีม Rasia
      .setFooter({ text: `Role ID: ${role.id}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`role_btn_${role.id}`)
        .setLabel('✨ กดเพื่อรับยศและเข้าบ้าน')
        .setStyle(ButtonStyle.Success),
    );

    await interaction.reply({ content: '✅ สร้างปุ่มรับยศสำหรับสมาชิกเรียบร้อยแล้ว!', flags: MessageFlags.Ephemeral });
    await interaction.channel.send({ embeds: [embed], components: [row] });
  },
};