// จำสั้นๆ ว่า "แอดมินคนไหนสั่งผ่านคำสั่งบอท" เพราะใน Audit Log ผู้ดำเนินการจะเป็นตัวบอทเอง
// ใช้ให้ log แสดงชื่อแอดมินตัวจริงแทน
const actions = new Map();

export function recordAction(type, targetId, adminId) {
  actions.set(`${type}:${targetId}`, { adminId, at: Date.now() });
  if (actions.size > 200) actions.delete(actions.keys().next().value);
}

export function takeAction(type, targetId) {
  const key = `${type}:${targetId}`;
  const action = actions.get(key);
  if (action && Date.now() - action.at < 30000) {
    actions.delete(key);
    return action;
  }
  return null;
}
