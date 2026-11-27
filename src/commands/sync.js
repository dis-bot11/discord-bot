import { SlashCommandBuilder } from 'discord.js';
import { supabase, getVoiceTimes } from '../utils/supabase.js';
import { refreshChart } from '../chart.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription('ตรวจสอบสถานะฐานข้อมูลเวลาออนเสียงและรีเฟรชระบบ'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบเท่านั้นที่ใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const dbTimes = await getVoiceTimes();
      const userCount = Object.keys(dbTimes).length;

      // รีเฟรชชาร์ตหรือข้อมูลแฟมิลี่ร่วมด้วย
      await refreshChart(interaction.client);

      await interaction.editReply(`✅ ระบบเชื่อมต่อกับ Supabase ปกติเรียบร้อยดีครับ! มีข้อมูลสถิติสมาชิกในระบบทั้งหมด \`${userCount}\` คน`);
    } catch (error) {
      console.error('Sync Command Error:', error);
      await interaction.editReply('❌ เกิดข้อผิดพลาดในการตรวจสอบฐานข้อมูล กรุณาเช็ก Console');
    }
  },
};