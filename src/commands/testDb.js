import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { supabase } from '../utils/supabase.js';

export default {
  data: new SlashCommandBuilder()
    .setName('test_db')
    .setDescription('ทดสอบเขียนข้อมูลจำลองลง Supabase ทันที'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบเท่านั้น!', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // ลองบันทึกข้อมูลเทสของแอดมิน (ใส่ไปสัก 120 นาที)
      const testUserId = interaction.user.id;
      const testMinutes = 120;

      const { data, error } = await supabase
        .from('voice_times')
        .upsert(
          { user_id: testUserId, minutes: testMinutes, updated_at: new Date() },
          { onConflict: ['user_id'] }
        )
        .select();

      if (error) {
        console.error('Supabase Test Error:', error);
        return interaction.editReply(`❌ บันทึกไม่สำเร็จ! Supabase แจ้ง Error: \`${error.message}\``);
      }

      await interaction.editReply(`✅ **เทสสำเร็จ!** เขียนข้อมูลลง Supabase ได้แล้วครับ\n- User ID: \`${testUserId}\`\n- Minutes: \`${testMinutes} นาที\`\n\nลองไปรีเฟรชดูที่หน้าเว็บ Supabase ตาราง \`voice_times\` ดูได้เลยครับว่าขยับขึ้นมายัง!`);

    } catch (err) {
      console.error('Test DB Exception:', err);
      await interaction.editReply(`❌ เกิดข้อผิดพลาดทางระบบ: ${err.message}`);
    }
  },
};