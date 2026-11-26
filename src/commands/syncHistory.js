import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../utils/supabase.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sync_history')
    .setDescription('ดึงและคำนวณเวลาออนห้องเสียงย้อนหลังตั้งแต่ 21/11/2569 12:00 น. (เฉพาะแอดมิน)')
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

      // กำหนดเวลาเริ่มต้นที่อนุญาตให้นับ: 21 พ.ย. 2569 เวลา 12:00:00 น. (UTC+7 -> แปลงเป็น Timestamp)
      // วันที่ 21 พ.ย. 2026 12:00:00 ICT = 21 พ.ย. 2026 05:00:00 UTC
      const START_TIMESTAMP = new Date('2026-11-21T12:00:00+07:00').getTime();

      const userSeconds = {};
      const activeJoins = {};
      let processedEvents = 0;
      let skippedOldEvents = 0;

      const MAX_SESSION_SECONDS = 6 * 3600; // 6 ชั่วโมงต่อรอบ

      for (const msg of messages) {
        // ข้ามข้อความที่เกิดขึ้นก่อนวันที่กำหนด
        if (msg.createdTimestamp < START_TIMESTAMP) {
          skippedOldEvents++;
          continue;
        }

        let contentText = msg.content || '';
        let embedText = '';
        
        if (msg.embeds.length > 0) {
          const embed = msg.embeds[0];
          const fieldsText = embed.fields.map(f => `${f.name || ''} ${f.value || ''}`).join(' ');
          const footerText = embed.footer?.text || '';
          embedText = `${embed.title || ''} ${embed.description || ''} ${fieldsText} ${footerText}`;
        }

        const fullText = `${contentText} ${embedText}`;

        const matchFooterId = fullText.match(/ID:\s*(\d{17,19})/);
        const matchMention = fullText.match(/<@!?(\d{17,19})>/);
        const userId = matchFooterId ? matchFooterId[1] : (matchMention ? matchMention[1] : null);
        
        if (!userId) continue;

        const msgTime = msg.createdTimestamp;

        const isJoin = /เข้าห้องเสียง/.test(fullText);
        const isMove = /ย้ายห้องเสียง/.test(fullText);
        const isLeave = /ออกจากห้องเสียง|ถูกตัดการเชื่อมต่อห้องเสียง/.test(fullText);
        const isMoveToAfk = isMove && /AFK/i.test(fullText);

        const closeSession = (endTime) => {
          if (!activeJoins[userId]) return;
          const durationSec = Math.floor((endTime - activeJoins[userId]) / 1000);
          
          if (durationSec > 0 && durationSec <= MAX_SESSION_SECONDS) {
            userSeconds[userId] = (userSeconds[userId] || 0) + durationSec;
          }
          delete activeJoins[userId];
        };

        if (isJoin) {
          delete activeJoins[userId];
          activeJoins[userId] = msgTime;
          processedEvents++;
        } else if (isMove) {
          closeSession(msgTime);
          if (!isMoveToAfk) {
            activeJoins[userId] = msgTime;
          }
          processedEvents++;
        } else if (isLeave) {
          closeSession(msgTime);
          processedEvents++;
        }
      }

      const totalUsers = Object.keys(userSeconds).length;
      if (totalUsers === 0) {
        return interaction.editReply('❌ ไม่พบคู่เหตุการณ์ เข้า-ออก ในช่วงเวลาที่กำหนด');
      }

      await interaction.editReply(`🔄 กำลังบันทึกยอดเวลาสะสมตั้งแต่ 21/11/2569 ของสมาชิก ${totalUsers} คนลง Supabase...`);

      let successCount = 0;
      for (const [userId, totalSec] of Object.entries(userSeconds)) {
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
        `✅ **ซิงค์เวลาเฉพาะตั้งแต่ 21 พ.ย. 2569 (12:00 น.) สำเร็จ!**\n` +
        `- ข้ามข้อความเก่าก่อนกำหนด: \`${skippedOldEvents} รายการ\`\n` +
        `- ประมวลผลเหตุการณ์จริง: \`${processedEvents} รายการ\`\n` +
        `- อัปเดตยอดเวลาลง Supabase: \`${successCount} คน\``
      );

    } catch (error) {
      console.error('Sync History Error:', error);
      await interaction.editReply('❌ เกิดข้อผิดพลาดในการดึงประวัติย้อนหลัง');
    }
  },
};