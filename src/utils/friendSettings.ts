export interface FriendPersona { name: string; intro: string; role: string; tone: string; personality: string; callSign: string }
export interface FriendProfile { userName: string; school: string; interests: string[]; goal: string }
export interface FriendMemory { id: string; text: string }
export interface FriendSettings { persona: FriendPersona; profile: FriendProfile; memories: FriendMemory[] }
const record = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value.trim() : fallback;
export function normalizeFriendSettings(value: unknown, displayName = ''): FriendSettings {
  const source = record(value), p = record(source.persona), u = record(source.profile);
  const userName = text(u.userName) || text(u.studentName) || text(p.callSign) || displayName.trim();
  const tone = text(p.tone || p.speechStyle);
  const personality = text(p.personality);
  return {
    persona: {
      name: text(p.name || p.robotName) || '소다봇', intro: text(p.intro),
      role: text(p.role) || '공부친구',
      tone: ['존댓말', '친근한 친구말', '선생님 말투'].includes(tone) ? tone : '친근한 친구말',
      personality: ['친절함', '차분함', '유쾌함', '논리적'].includes(personality) ? personality : personality === 'bright' ? '유쾌함' : '친절함',
      callSign: userName, // Legacy readers use the same single name.
    },
    profile: {
      userName, school: text(u.school), goal: text(u.goal || u.dream),
      interests: [...new Set((Array.isArray(u.interests) ? u.interests : text(u.interests).split(',')).map(v => text(v)).filter(Boolean))],
    },
    memories: (Array.isArray(source.memories) ? source.memories : []).map((m, i) => {
      const item = record(m); return { id: text(item.id) || `mem_${i + 1}`, text: text(item.text || item.content) };
    }).filter(m => m.text).slice(0, 3),
  };
}
export function validateFriendSettings(value: unknown): string | null {
  const s = record(value);
  if (!s.persona || !s.profile || !Array.isArray(s.memories) || s.memories.length > 3) return '친구·프로필 정보와 최대 3개의 기억을 확인해주세요.';
  for (const [part, keys] of [[s.persona, ['name','robotName','intro','role','tone','personality','callSign']], [s.profile, ['userName','studentName','school','goal','dream']]] as const) {
    if (!part || typeof part !== 'object' || Array.isArray(part)) return '설정 형식이 올바르지 않습니다.';
    for (const key of keys) if (part[key] !== undefined && (typeof part[key] !== 'string' || part[key].length > 1000)) return '설정 항목은 1,000자 이내의 문자열이어야 합니다.';
  }
  const interests = s.profile.interests;
  if (interests !== undefined && !(typeof interests === 'string' && interests.length <= 1000) && !(Array.isArray(interests) && interests.length <= 20 && interests.every(v => typeof v === 'string' && v.length <= 100))) return '관심사 형식이 올바르지 않습니다.';
  if (s.memories.some((m: unknown) => { const item=record(m); return typeof (item.text ?? item.content) !== 'string' || (item.text ?? item.content).length > 1000; })) return '기억은 1,000자 이내의 문자열이어야 합니다.';
  return null;
}
export function friendToneInstruction(tone: string): string {
  if (tone === '선생님 말투') return '차분하고 친절한 선생님처럼 존댓말로 설명하고, 이해를 돕는 예시와 질문을 사용하세요.';
  if (tone === '존댓말') return '다정하고 예의 있는 존댓말로 대화하세요.';
  return '친근한 친구처럼 자연스러운 반말로 대화하세요.';
}
export function resolveFriendUser<T extends { id: string; personalApiKey?: string }>(token: string, users: T[], sessionId?: string): T | undefined {
  if (!token.trim()) return undefined;
  return users.find(user => user.personalApiKey === token.trim()) || (sessionId ? users.find(user => user.id === sessionId) : undefined);
}
