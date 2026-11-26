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
      const logChannel = interaction.guild.channels.cache.find(
        c => c.name.includes('log-ห้องเสียง') || c.name.includes('voice-log') || c.name.includes('เสียง')
      );

      if (!logChannel) {
        return interaction.editReply('❌ ไม่พบห้อง Log สำหรับเสียงในเซิร์ฟเวอร์นี้');
      }

      await interaction.editReply(`🔄 กำลังกวาดข้อความประวัติจากห้อง <#${logChannel.id}> ทั้งหมด...`);

      let messages = [];
      let lastId = null;

      while (true) {
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
        return interaction.editReply('❌ ไม่พบข้อความประวัติในห้อง Log');
      }

      // เรียงจากเก่าสุดไปใหม่สุด
      messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      const userSeconds = {}; // เก็บสะสมเป็นวินาทีก่อน เพื่อความแม่นยำสูงสุด
      const activeJoins = {};
      let processedEvents = 0;

      for (const msg of messages) {
        let contentText = msg.content || '';
        let embedText = '';
        
        if (msg.embeds.length > 0) {
          const embed = msg.embeds[0];
          const fieldsText = embed.fields.map(f => `${f.name || ''} ${f.value || ''}`).join(' ');
          const footerText = embed.footer?.text || ''; // ดึง ID จาก Footer ด้วย
          embedText = `${embed.title || ''} ${embed.description || ''} ${fieldsText} ${footerText}`;
        }

        const fullText = `${contentText} ${embedText}`;

        // ดึง UID 17-19 หลัก (ให้ความสำคัญกับ ID: xxx ใน Footer ก่อน หรือ Mention)
        const matchFooterId = fullText.match(/ID:\s*(\d{17,19})/);
        const matchMention = fullText.match(/<@!?(\d{17,19})>/);
        const userId = matchFooterId ? matchFooterId[1] : (matchMention ? matchMention[1] : null);
        
        if (!userId) continue;

        const msgTime = msg.createdTimestamp;

        // แยกเหตุการณ์ให้ชัดเจนตามหัวข้อ Embed ของบอทพี่
        const isJoin = /เข้าห้องเสียง/.test(fullText);
        const isLeave = /ออกจากห้องเสียง|ถูกตัดการเชื่อมต่อห้องเสียง/.test(fullText);

        if (isJoin) {
          activeJoins[userId] = msgTime;
          processedEvents++;
        } else if (isLeave && activeJoins[userId]) {
          const durationSec = Math.floor((msgTime - activeJoins[userId]) / 1000);

          // นับตั้งแต่ 1 วินาทีขึ้นไป และไม่เกิน 24 ชม. (86400 วินาที)
          if (durationSec > 0 && durationSec < 86400) {
            userSeconds[userId] = (userSeconds[userId] || 0) + durationSec;
          }
          
          delete activeJoins[userId];
          processedEvents++;
        }
      }

      const totalUsers = Object.keys(userSeconds).length;
      if (totalUsers === 0) {
        return interaction.editReply('❌ ไม่พบคู่เหตุการณ์ เข้า-ออก ที่สมบูรณ์ใน Log');
      }

      await interaction.editReply(`🔄 กำลังบันทึกยอดเวลาสะสมของสมาชิก ${totalUsers} คนลง Supabase...`);

      let successCount = 0;
      for (const [userId, totalSec] of Object.entries(userSeconds)) {
        // แปลงวินาทีรวมเป็นนาที (ปัดขึ้นขั้นต่ำ 1 นาทีถ้ามีประวัติออน)
        const totalMinutes = Math.max(1, Math.floor(totalSec / 60));

        const { error } = await supabase
          .from('voice_times')
          .upsert({ 
            user_id: String(userId), 
            minutes: totalMinutes, 
            updated_at: new Date() 
          }, { onConflict: ['user_id'] });

        if (!error) {
          successCount++;
        } else {
          console.error(`Supabase Upsert Error [${userId}]:`, error);
        }
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