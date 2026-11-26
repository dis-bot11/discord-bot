import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { supabase } from '../utils/supabase.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sync_history')
    .setDescription('ไล่แกะ Log เข้า-ออกตามลำดับเวลาจริงและสะสมเวลาลง Supabase แบบละเอียด'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบเท่านั้นที่ใช้คำสั่งนี้ได้ครับ!', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const logChannel = interaction.guild.channels.cache.find(c => c.name.includes('log-ห้องเสียง') || c.name.includes('เสียง'));
      
      if (!logChannel) {
        return interaction.editReply('❌ ไม่พบห้อง log-ห้องเสียง ในเซิร์ฟเวอร์นี้');
      }

      await interaction.editReply(`🔄 กำลังดึงและเรียงลำดับข้อความ Log ทั้งหมดตามเวลาจริง...`);

      let messages = [];
      let lastId = null;
      let fetching = true;

      // ดึงข้อความทั้งหมดในห้อง Log มาเก็บไว้
      while (fetching) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetched = await logChannel.messages.fetch(options);
        if (fetched.size === 0) break;

        const fetchedArray = Array.from(fetched.values());
        for (const msg of fetchedArray) {
          messages.push(msg);
        }

        lastId = fetchedArray[fetchedArray.length - 1].id;
        if (fetchedArray.length < 100) break;
      }

      // เรียงลำดับจากเก่าไปใหม่ (Chronological Order) เพื่อจำลองเหตุการณ์จริง
      messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      const userMinutes = {}; // เก็บเวลารวมเป็นนาที { userId: totalMinutes }
      const activeJoins = {}; // เก็บเวลาที่เข้าห้องล่าสุด { userId: timestamp }

      let eventCount = 0;

      for (const msg of messages) {
        let contentText = msg.content || '';
        let embedText = '';
        
        if (msg.embeds.length > 0) {
          const embed = msg.embeds[0];
          embedText = `${embed.title || ''} ${embed.description || ''} ${embed.fields.map(f => `${f.name || ''} ${f.value || ''}`).join(' ')}`;
        }

        const fullText = `${contentText} ${embedText}`;

        // ค้นหา User ID จากข้อความ
        const matchUser = fullText.match(/<@!?(\d+)>|(\d{17,19})/);
        if (!matchUser) continue;
        
        const userId = matchUser[1] || matchUser[2];
        if (!userId) continue;

        const msgTime = msg.createdTimestamp;

        // เช็กคำว่า เข้า หรือ ออก
        const isJoin = /เข้า|join|connected|add|Joined/i.test(fullText);
        const isLeave = /ออก|leave|disconnected|move|switch|Left/i.test(fullText);

        // กรณีเข้าห้อง
        if (isJoin && !isLeave) {
          activeJoins[userId] = msgTime; // บันทึกเวลาเริ่มเข้า
          eventCount++;
        } 
        // กรณีออกจากห้อง และมีบันทึกเวลาเข้าไว้ก่อนหน้า
        else if (isLeave && activeJoins[userId]) {
          const durationMs = msgTime - activeJoins[userId];
          const durationMins = Math.floor(durationMs / 60000); // แปลงเป็นนาที

          // เช็กความสมเหตุสมผล (มากกว่า 0 นาที และไม่เกิน 24 ชม. ต่อรอบเพื่อป้องกันค่าผิดปกติ)
          if (durationMins > 0 && durationMins < 1440) {
            userMinutes[userId] = (userMinutes[userId] || 0) + durationMins;
          }
          
          delete activeJoins[userId]; // ล้างสถานะออกเมื่อออกจากห้อง
          eventCount++;
        }
      }

      const totalUsers = Object.keys(userMinutes).length;
      if (totalUsers === 0) {
        return interaction.editReply('❌ ไม่พบประวัติการเข้า-ออกที่สมบูรณ์ กรุณาตรวจสอบรูปแบบข้อความใน Log');
      }

      await interaction.editReply(`🔄 กำลังบันทึกเวลาสะสมของสมาชิก ${totalUsers} คนลง Supabase...`);

      // บันทึกลง Supabase
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

      await interaction.editReply(`✅ **ซิงค์สำเร็จ!**\n- อ่านข้อความ Log: \`${messages.length} ข้อความ\`\n- จับคู่เหตุการณ์เข้า-ออก: \`${eventCount} รายการ\`\n- อัปเดตลง Supabase: \`${successCount} คน\` เรียบร้อยแล้วครับ!`);

    } catch (error) {
      console.error('Sync History Error:', error);
      await interaction.editReply('❌ เกิดข้อผิดพลาดในการประมวลผลประวัติย้อนหลัง');
    }
  },
};