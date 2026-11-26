import 'dotenv/config'; // 👈 เพิ่มบรรทัดนี้เพื่อให้สคริปต์อ่านค่าจากไฟล์ .env ได้
import { supabase } from './src/utils/supabase.js';
import { activeSessions } from './src/events/voiceStateUpdate.js';

async function forceSyncLiveTimes() {
  console.log('🔄 กำลังบังคับดึงเวลาสดจากบอทเพื่อบันทึกเข้า Supabase...');
  
  const now = Date.now();
  if (activeSessions.size === 0) {
    console.log('⚠️ ตอนนี้ไม่มีใครออนอยู่ในห้องเสียงเลย (activeSessions ว่างเปล่า)');
    process.exit(0);
  }

  for (const [userId, joinedAt] of activeSessions.entries()) {
    const liveMinutes = Math.floor((now - joinedAt) / 60000);
    const totalMinutes = liveMinutes > 0 ? liveMinutes : 1;

    const { error } = await supabase
      .from('voice_times')
      .upsert({ user_id: userId, minutes: totalMinutes, updated_at: new Date() }, { onConflict: ['user_id'] });

    if (error) {
      console.error(`❌ บันทึกยูสเซอร์ ${userId} ไม่สำเร็จ:`, error.message);
    } else {
      const hours = (totalMinutes / 60).toFixed(1);
      console.log(`✅ บังคับบันทึกยูสเซอร์ ${userId} สำเร็จ — ยอดรวม ${totalMinutes} นาที (${hours} ชม.)`);
    }
  }

  console.log('🎉 บันทึกข้อมูลลง Supabase สำเร็จแล้ว! ลองรีเฟรชหน้าเว็บดูได้เลยครับ');
  process.exit(0);
}

forceSyncLiveTimes();