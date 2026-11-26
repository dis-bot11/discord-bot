import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ฟังก์ชันดึงข้อมูลเวลาทั้งหมดจาก Supabase (แปลงกลับเป็นรูปแบบ object เดิม)
export async function getVoiceTimes() {
  const { data, error } = await supabase.from('voice_times').select('user_id, minutes');
  if (error) {
    console.error('Error fetching voice times:', error.message);
    return {};
  }
  const result = {};
  data.forEach(row => {
    result[row.user_id] = row.minutes;
  });
  return result;
}

// ฟังก์ชันบันทึกหรือบวกเวลาเพิ่มให้ User คนนั้นๆ แบบเรียลไทม์
export async function addVoiceMinutes(userId, minutesToAdd) {
  const { data, error: fetchError } = await supabase
    .from('voice_times')
    .select('minutes')
    .eq('user_id', userId)
    .single();

  let currentMinutes = 0;
  if (!fetchError && data) {
    currentMinutes = data.minutes || 0;
  }

  const newTotal = currentMinutes + minutesToAdd;

  const { error: upsertError } = await supabase
    .from('voice_times')
    .upsert({ user_id: userId, minutes: newTotal, updated_at: new Date() }, { onConflict: ['user_id'] });

  if (upsertError) {
    console.error('Error updating voice time:', upsertError.message);
  }
}