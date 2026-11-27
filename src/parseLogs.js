import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { supabase } from './utils/supabase.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const LOG_CHANNEL_ID = '1573183955321233529';
const START_TIME = new Date('2026-11-26T11:45:00+07:00');
const END_TIME = new Date('2026-11-27T10:36:00+07:00');

client.once('ready', async () => {
  console.log(`🤖 กำลังประมวลผล Log ช่วง 26-27 พ.ย. จากห้อง ${LOG_CHANNEL_ID}...`);

  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.error('❌ ไม่พบห้อง Log หรือไม่ใช่ห้องข้อความ');
      process.exit(1);
    }

    let lastMessageId;
    let fetchedMessages = [];
    let keepFetching = true;

    while (keepFetching) {
      const options = { limit: 100 };
      if (lastMessageId) options.before = lastMessageId;

      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) break;

      for (const msg of messages.values()) {
        fetchedMessages.push(msg);
        lastMessageId = msg.id;

        if (msg.createdAt < START_TIME) {
          keepFetching = false;
        }
      }
      if (messages.size < 100) break;
    }

    // เรียงข้อความจากเก่าไปใหม่ เพื่อจำลองเหตุการณ์ตามเวลาจริง
    fetchedMessages.sort((a, b) => a.createdAt - b.createdAt);

    const activeSessions = {};
    const userTotalMinutes = {};

    for (const msg of fetchedMessages) {
      if (msg.createdAt < START_TIME || msg.createdAt > END_TIME) continue;

      const content = msg.content || '';
      const embedDesc = msg.embeds[0]?.description || '';
      const fullText = `${content} ${embedDesc}`;

      const userMatch = fullText.match(/<@!?(\d+)>/);
      if (!userMatch) continue;
      const userId = userMatch[1];

      const isJoin = fullText.includes('เข้า <#') || fullText.includes('➜ <#');
      const isLeave = fullText.includes('ออกจาก <#') || (fullText.includes('<#') && fullText.includes('➜') && !fullText.includes('เข้า <#'));

      if (isJoin && !isLeave) {
        activeSessions[userId] = msg.createdAt;
      } else if (isLeave || fullText.includes('ออกจาก')) {
        if (activeSessions[userId]) {
          const joinTime = activeSessions[userId];
          const leaveTime = msg.createdAt;
          const diffMinutes = Math.floor((leaveTime - joinTime) / (1000 * 60));

          if (diffMinutes > 0 && diffMinutes < 1440) {
            userTotalMinutes[userId] = (userTotalMinutes[userId] || 0) + diffMinutes;
          }
          delete activeSessions[userId];
        }
      }
    }

    // กรณีคนที่ยังอยู่ในห้องตอนถึง END_TIME ให้คิดเวลาค้างไว้จนถึง END_TIME
    for (const [userId, joinTime] of Object.entries(activeSessions)) {
      const diffMinutes = Math.floor((END_TIME - joinTime) / (1000 * 60));
      if (diffMinutes > 0) {
        userTotalMinutes[userId] = (userTotalMinutes[userId] || 0) + diffMinutes;
      }
    }

    console.log('📊 สรุปเวลารวมที่คำนวณได้จาก Log จริง:', userTotalMinutes);

    // บันทึกลงตารางแยก voice_times_historical โดยตรง (แทนที่ของเดิมแบบปลอดภัย)
    for (const [userId, minutes] of Object.entries(userTotalMinutes)) {
      const { error } = await supabase
        .from('voice_times_historical')
        .upsert({ 
          user_id: userId, 
          minutes: minutes, 
          updated_at: new Date() 
        }, { onConflict: 'user_id' });

      if (error) {
        console.error(`❌ บันทึกให้ ${userId} ลงตาราง historical ไม่สำเร็จ:`, error.message);
      } else {
        console.log(`✅ อัปเดตตาราง Historical | User ID: ${userId} | ยอดรวม: ${minutes} นาที`);
      }
    }

    console.log('🎉 ประมวลผลและอัปเดตลงตารางแยก (Historical) สำเร็จเรียบร้อย!');
    process.exit(0);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  }
});

client.login(config.token);