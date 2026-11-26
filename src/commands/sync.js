import { SlashCommandBuilder } from 'discord.js';
import { supabase, getVoiceTimes } from '../utils/supabase.js';
// *หมายเหตุ: เช็กบรรทัด import activeSessions ให้ตรงกับโปรเจกต์พี่นะครับ เช่น ถ้าย้ายมาจาก events หรือ index ให้ปรับพาธให้ถูกครับ
import { activeSessions } from '../events/voiceStateUpdate.js'; 

export default {
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription('ซิงค์เวลาสดในห้องเสียงทั้งหมดขึ้น Supabase ทันที'),

  async execute(interaction) {
    // เช็กสิทธิ์เฉพาะแอดมินหรือหัวแฟม (ปรับเปลี่ยนตามชื่อยศแอดมินของพี่ได้ครับ)
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบเท่านั้นที่ใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const dbTimes = await getVoiceTimes();
      const now = Date.now();
      const combined = { ...dbTimes };

      // ดึงเวลาจากคนที่กำลังออนอยู่ในแรมตอนนี้มาบวกเพิ่ม
      for (const [userId, joinedAt] of activeSessions.entries()) {
        const liveMinutes = Math.floor((now - joinedAt) / 60000);
        const baseMinutes = dbTimes[userId] || 0;
        combined[userId] = baseMinutes + liveMinutes;
      }

      // บันทึกข้ามขึ้น Supabase
      let successCount = 0;
      for (const [userId, totalMinutes] of Object.entries(combined)) {
        if (totalMinutes <= 0) continue;

        const { error } = await supabase
          .from('voice_times')
          .upsert({ user_id: userId, minutes: totalMinutes, updated_at: new Date() }, { onConflict: ['user_id'] });

        if (!error) successCount++;
      }

      await interaction.editReply(`✅ ซิงค์ข้อมูลเวลาของสมาชิก ${successCount} คนขึ้น Supabase เรียบร้อยแล้วครับ!`);
    } catch (error) {
      console.error('Sync Command Error:', error);
      await interaction.editReply('❌ เกิดข้อผิดพลาดในการซิงค์ข้อมูล กรุณาเช็ก Console');
    }
  },
};