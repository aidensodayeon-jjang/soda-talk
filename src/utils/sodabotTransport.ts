// One live transport shared by every screen; persisted IP is only a reconnect hint.
type Reply = { id?: string; state?: string; reason?: string; ip?: string };
class SodabotTransport {
  private ws: WebSocket | null = null;
  private opening: Promise<void> | null = null;
  private device: any = null;
  private write: any = null;
  private notify: any = null;
  private serial: any = null;
  private sequence = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, { resolve: (v: Reply) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private serialBuffer = '';
  private notifyBuffer = '';
  private serialReader: any = null;
  get type(): 'wifi' | 'ble' | 'serial' | 'none' {
    if (this.serial?.writable) return 'serial';
    if (this.ws?.readyState === WebSocket.OPEN) return 'wifi';
    if (this.device?.gatt?.connected && this.write) return 'ble';
    return 'none';
  }
  private changed() {
    localStorage.removeItem('sodabot_connected');
    window.dispatchEvent(new Event('sodabot-status-changed'));
  }
  private receive = (raw: string) => {
    let reply: any;
    try { reply = JSON.parse(raw); } catch { return; }
    if (reply.ip) localStorage.setItem('sodabot_robot_ip', reply.ip);
    if (reply.event === 'button_pressed' || reply.event === 'button') {
      window.dispatchEvent(new CustomEvent('sodabot-button-event', { detail: reply }));
    }
    if (!reply.id) return;
    const entry = this.pending.get(reply.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(reply.id);
    if (reply.state === 'error') entry.reject(new Error(`소다봇 명령 오류: ${reply.reason || '처리 실패'}`));
    else entry.resolve(reply);
  };
  private onNotify = (event: any) => {
    this.notifyBuffer += new TextDecoder().decode(event.target.value);
    let newline: number;
    while ((newline = this.notifyBuffer.indexOf('\n')) >= 0) {
      this.receive(this.notifyBuffer.slice(0, newline));
      this.notifyBuffer = this.notifyBuffer.slice(newline + 1);
    }
    if (this.notifyBuffer.length > 2048) this.notifyBuffer = '';
  };
  attachBle(device: any, write: any, notify: any) {
    this.notify?.removeEventListener('characteristicvaluechanged', this.onNotify);
    const oldSocket = this.ws; this.ws = null; oldSocket?.close();
    this.notifyBuffer = '';
    this.device = device; this.write = write; this.notify = notify;
    notify.addEventListener('characteristicvaluechanged', this.onNotify);
    device.addEventListener('gattserverdisconnected', () => {
      if (this.device !== device) return;
      this.write = null;
      this.changed();
    });
    this.changed();
  }
  async attachSerial(port: any) {
    this.serial = port;
    this.changed();
    const reader = port.readable.getReader();
    this.serialReader = reader;
    const decoder = new TextDecoder();
    try {
      while (this.serial === port) {
        const { value, done } = await reader.read();
        if (done) break;
        this.serialBuffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = this.serialBuffer.indexOf('\n')) >= 0) {
          this.receive(this.serialBuffer.slice(0, newline).trim());
          this.serialBuffer = this.serialBuffer.slice(newline + 1);
        }
        if (this.serialBuffer.length > 4096) this.serialBuffer = '';
      }
    } finally {
      reader.releaseLock();
      if (this.serialReader === reader) this.serialReader = null;
      if (this.serial === port) this.serial = null;
      this.changed();
    }
  }
  async connectWifi(ip: string): Promise<void> {
    if (this.ws?.url === `ws://${ip}:8080/soda/ws` && this.ws.readyState === WebSocket.OPEN) return;
    if (this.opening) return this.opening;
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split('.').some(n => +n > 255)) throw new Error('올바른 로봇 IP를 입력하세요.');
    const previous = this.ws;
    this.ws = null;
    previous?.close();
    this.opening = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://${ip}:8080/soda/ws`);
      this.ws = ws;
      const timer = setTimeout(() => { ws.close(); reject(new Error('로봇 Wi-Fi 연결 시간 초과. 같은 네트워크인지 확인하세요.')); }, 5000);
      ws.onmessage = event => this.receive(String(event.data));
      ws.onopen = () => {
        clearTimeout(timer);
        localStorage.setItem('sodabot_robot_ip', ip);
        this.changed(); resolve();
      };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('로봇 Wi-Fi 연결 실패. 블루투스로 연결하거나 로컬 웹 주소에서 다시 시도하세요.')); };
      ws.onclose = () => {
        clearTimeout(timer);
        if (this.ws === ws) { this.ws = null; this.changed(); }
        reject(new Error('로봇 연결이 닫혔습니다.'));
      };
    });
    try { await this.opening; } finally { this.opening = null; }
  }
  send(action: string, value = '', extra: Record<string, unknown> = {}): Promise<Reply> {
    const run = this.tail.then(() => this.execute(action, value, extra));
    this.tail = run.catch(() => {});
    return run;
  }
  private async execute(action: string, value: string, extra: Record<string, unknown>): Promise<Reply> {
    if (this.type === 'none') {
      const ip = localStorage.getItem('sodabot_robot_ip');
      if (ip) await this.connectWifi(ip);
    }
    const link = this.type;
    if (link === 'none') throw new Error('소다봇을 먼저 연결해 주세요.');
    const id = String(++this.sequence);
    const payload = JSON.stringify({ ...extra, action, value, id });
    const bytes = new TextEncoder().encode(payload + '\n');
    if (bytes.length > 4096) throw new Error('명령이 너무 깁니다. 텍스트를 줄여 주세요.');
    const result = new Promise<Reply>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('소다봇 처리 응답이 없습니다. 수정된 soda-basic 펌웨어를 업로드했는지 확인하세요.'));
      }, 20000);
      this.pending.set(id, { resolve, reject, timer });
    });
    // Install rejection handler before asynchronous BLE writes finish.
    void result.catch(() => {});
    try {
      if (link === 'serial') {
        const writer = this.serial.writable.getWriter();
        try { await writer.write(bytes); } finally { writer.releaseLock(); }
      } else if (link === 'wifi') {
        this.ws!.send(payload);
      } else {
        // 20-byte chunks work with the minimum BLE MTU; firmware joins UTF-8 bytes.
        for (let i = 0; i < bytes.length; i += 20) await this.write.writeValueWithResponse(bytes.slice(i, i + 20));
      }
    } catch (error) {
      const pending = this.pending.get(id);
      if (pending) { clearTimeout(pending.timer); this.pending.delete(id); pending.reject(error instanceof Error ? error : new Error(String(error))); }
    }
    return result;
  }
  disconnect() {
    const ws = this.ws; this.ws = null; ws?.close();
    this.device?.gatt?.disconnect();
    this.device = null; this.write = null;
    // Cancel the reader before closing a Web Serial port.
    const port = this.serial; this.serial = null;
    const reader = this.serialReader;
    if (port) void (async () => {
      try { await reader?.cancel(); await port.close(); } catch (error) { console.error(error); }
    })();
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('연결을 해제했습니다.')); }
    this.pending.clear();
    localStorage.removeItem('sodabot_robot_ip');
    this.changed();
  }
}
export const sodabotTransport = new SodabotTransport();
