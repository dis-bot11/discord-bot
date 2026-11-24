import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../logger.js';
import { requireAdmin } from '../permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ยศทั้งหมด')
    .setDescription('ดูรายชื่อยศพร้อมไอดี (ไว้ตั้งค่า CHART_ROLE_IDS / ADMIN_ROLE_IDS) เฉพาะผู้ดูแล'),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const roles = interaction.guild.roles.cache
      .filter((role) => role.id !== interaction.guildId)
      .sort((a, b) => b.position - a.position);

    let text = '';
    let shown = 0;
    for (const role of roles.values()) {
      const line = `${role.name} | ${role.id} | ${role.members.size} คน${role.managed ? ' | บอท/ระบบ' : ''}\n`;
      if ((text + line).length > 3800) break;
      text += line;
      shown += 1;
    }
    if (shown < roles.size) text += `…และอีก ${roles.size - shown} ยศ`;

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle('ยศทั้งหมด (เรียงจากสูงไปต่ำ)')
          .setDescription(`\`\`\`\n${text}\`\`\``),
      ],
    });
  },
};
