import { SlashCommandBuilder } from 'discord.js';
import { buildChartEmbed } from '../chart.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ผังแฟม')
    .setDescription('ดูผังโครงสร้างแฟมตามยศปัจจุบัน'),
  async execute(interaction) {
    await interaction.reply({ embeds: [buildChartEmbed(interaction.guild)] });
  },
};
