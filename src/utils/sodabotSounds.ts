export const soundPresets = [
  { id: 'chime', name: '맑은 알림', notes: [[440, 150], [880, 250]] },
  { id: 'rise', name: '도레미', notes: [[523, 120], [659, 120], [784, 200]] },
  { id: 'fall', name: '내려가는 음', notes: [[784, 120], [659, 120], [523, 200]] },
  { id: 'beep', name: '짧은 삑', notes: [[1000, 80]] },
  { id: 'bounce', name: '통통', notes: [[400, 100], [600, 150]] },
  { id: 'off', name: '소리 끄기', notes: [] },
];
export const defaultSoundSettings: Record<string, string> = {
  power_on: 'chime', greeting: 'rise', button_click: 'beep', touch_react: 'bounce',
};
export function normalizeSoundSettings(value: unknown): Record<string, string> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(defaultSoundSettings).map(([event, fallback]) => [
    event, soundPresets.some(p => p.id === source[event]) ? source[event] as string : fallback,
  ]));
}
