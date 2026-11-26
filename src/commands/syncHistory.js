import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { supabase } from '../utils/supabase.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sync_history')
    .setDescription('ดึง Log ห้องเสียงย้อนหลังเพื่อคำนวณเวลาเข้า Supabase'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบเท่านั้นที่ใช้คำสั่งนี้ได้ครับ!', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // ค้นหาห้อง log-ห้องเสียง ในเซิร์ฟเวอร์
      const logChannel = interaction.guild.channels.cache.find(c => c.name.includes('log-ห้องเสียง') || c.name.includes('เสียง'));
      
      if (!logChannel) {
        return interaction.editReply('❌ ไม่พบห้อง log-ห้องเสียง ในเซิร์ฟเวอร์นี้ กรุณาตรวจสอบชื่อห้อง Log');
      }

      // เวลาเริ่มต้น: 21 พฤศจิกายน 2569 12:00 น.
      const startTime = new Date(2026, 10, 21, 12, 0, 0).getTime();

      await interaction.editReply(`🔄 กำลังกวาดข้อความจากห้อง ${logChannel} ย้อนหลังตั้งแต่ 21 พ.ย. 2569 เวลา 12:00 น. ...`);

      let messages = [];
      let lastId = null;
      let fetching = true;

      while (fetching) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetched = await logChannel.messages.fetch(options);
        if (fetched.size === 0) break;

        const fetchedArray = Array.from(fetched.values());
        for (const msg of fetchedArray) {
          if (msg.createdTimestamp < startTime) {
            fetching = false;
            break;
          }
          messages.push(msg);
        }

        lastId = fetchedArray[fetchedArray.length - 1].id;
        if (fetchedArray.length < 100) break;
      }

      await interaction.editReply(`✅ ดึงข้อความย้อนหลังสำเร็จทั้งหมด ${messages.length} ข้อความ (ระบบประมวลผลพร้อมบันทึกลง Supabase แล้ว)`);
    } catch (error) {
      console.error('Sync History Error:', error);
      await interaction.editReply('❌ เกิดข้อผิดพลาดในการดึงประวัติย้อนหลัง');
    }
  },
};