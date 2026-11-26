import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../utils/supabase.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sync_history')
    .setDescription('ดึงและคำนวณเวลาออนห้องเสียงย้อนหลังอย่างแม่นยำจากห้อง Log (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // 1. ค้นหาห้อง Log ห้องเสียงในเซิร์ฟเวอร์
      const logChannel = interaction.guild.channels.cache.find(
        c => c.name.includes('log-ห้องเสียง') || c.name.includes('voice-log') || c.name.includes('เสียง')
      );

      if (!logChannel) {
        return interaction.editReply('❌ ไม่พบห้อง Log สำหรับเสียงในเซิร์ฟเวอร์นี้ (กรุณาตรวจสอบชื่อห้อง log)');
      }

      await interaction.editReply(`🔄 กำลังกวาดข้อความประวัติจากห้อง <#${logChannel.id}> ทั้งหมดเพื่อคำนวณเวลา...`);

      let messages = [];
      let lastId = null;
      let fetching = true;

      // 2. ดึงข้อความทั้งหมดจากห้อง Log แบบวนลูป (รองรับข้อความจำนวนมาก)
      while (fetching) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetched = await logChannel.messages.fetch(options);
        if (fetched.size === 0) break;

        const fetchedArray = Array.from(fetched.values());
        messages.push(...fetchedArray);

        lastId = fetchedArray[fetchedArray.length - 1].id;
        if (fetchedArray.length < 100) break;
      }

      if (messages.length === 0) {
        return interaction.editReply('❌ ไม่พบข้อความประวัติในห้อง Log เลยครับ');
      }

      // 3. เรียงลำดับข้อความจาก "เก่าสุด ไปหา ใหม่สุด" (Chronological Order) เพื่อจำลองเหตุการณ์จริง
      messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      const userMinutes = {}; // เก็บยอดเวลารวมสะสมของแต่ละคน { userId: totalMinutes }
      const activeJoins = {}; // เก็บเวลาที่ User เริ่มเข้าห้อง { userId: timestamp }

      let processedEvents = 0;

      for (const msg of messages) {
        let contentText = msg.content || '';
        let embedText = '';
        
        if (msg.embeds.length > 0) {
          const embed = msg.embeds[0];
          embedText = `${embed.title || ''} ${embed.description || ''} ${embed.fields.map(f => `${f.name || ''} ${f.value || ''}`).join(' ')}`;
        }

        const fullText = `${contentText} ${embedText}`;

        // ค้นหา User ID จากข้อความ (รองรับทั้ง Mention และ ID ตรงๆ)
        const matchUser = fullText.match(/<@!?(\d+)>|(\d{17,19})/);
        if (!matchUser) continue;
        
        const userId = matchUser[1] || matchUser[2];
        if (!userId) continue;

        const msgTime = msg.createdTimestamp;

        // ตรวจสอบว่าเป็นเหตุการณ์เข้า หรือ ออก
        const isJoin = /เข้า|join|connected|add|Joined/i.test(fullText);
        const isLeave = /ออก|leave|disconnected|move|switch|Left/i.test(fullText);

        // ถ้าเป็นการเข้าห้อง
        if (isJoin && !isLeave) {
          activeJoins[userId] = msgTime;
          processedEvents++;
        } 
        // ถ้าเป็นการออกจากห้อง และมีบันทึกเวลาเข้าไว้ก่อนหน้า
        else if (isLeave && activeJoins[userId]) {
          const durationMs = msgTime - activeJoins[userId];
          const durationMins = Math.floor(durationMs / 60000); // แปลงเป็นนาที

          // กรองเคสเวลาที่สมเหตุสมผล (มากกว่า 0 นาที และไม่เกิน 24 ชม. ต่อรอบเพื่อกันบั๊กค้าง)
          if (durationMins > 0 && durationMins < 1440) {
            userMinutes[userId] = (userMinutes[userId] || 0) + durationMins;
          }
          
          delete activeJoins[userId];
          processedEvents++;
        }
      }

      const totalUsers = Object.keys(userMinutes).length;
      if (totalUsers === 0) {
        return interaction.editReply('❌ ประมวลผล Log แล้ว แต่ไม่พบคู่เหตุการณ์ เข้า-ออก ที่สมบูรณ์');
      }

      await interaction.editReply(`🔄 กำลังบันทึกยอดเวลาสะสมของสมาชิก ${totalUsers} คนลง Supabase...`);

      // 4. บันทึกลง Supabase ทีละคนอย่างแม่นยำ
      let successCount = 0;
      for (const [userId, totalMinutes] of Object.entries(userMinutes)) {
        const { error } = await supabase
          .from('voice_times')
          .upsert({ 
            user_id: userId, 
            minutes: totalMinutes, 
            updated_at: new Date() 
          }, { onConflict: ['user_id'] });

        if (!error) successCount++;
      }

      await interaction.editReply(
        `✅ **ซิงค์ประวัติย้อนหลังสำเร็จเรียบร้อย!**\n` +
        `- อ่านข้อความ Log ทั้งหมด: \`${messages.length} ข้อความ\`\n` +
        `- จับคู่เหตุการณ์เข้า-ออกจริง: \`${processedEvents} รายการ\`\n` +
        `- อัปเดตเวลาลง Supabase สำเร็จ: \`${successCount} คน\``
      );

    } catch (error) {
      console.error('Sync History Error:', error);
      await interaction.editReply('❌ เกิดข้อผิดพลาดในการดึงประวัติย้อนหลัง');
    }
  },
};