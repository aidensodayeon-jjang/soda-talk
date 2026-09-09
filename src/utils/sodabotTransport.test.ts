import assert from 'node:assert/strict';
const saved = new Map<string,string>();
(globalThis as any).localStorage = {getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v),removeItem:(k:string)=>saved.delete(k)};
(globalThis as any).window = new EventTarget();
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: any; onclose: any; onmessage: any; onerror: any;
  sent: any[] = [];
  constructor(public url:string) { Socket.instances.push(this); setTimeout(()=>{this.readyState=1;this.onopen?.();},0); }
  send(data:string) {
    const packet=JSON.parse(data);this.sent.push(packet);
    setTimeout(()=>this.onmessage?.({data:JSON.stringify({id:packet.id,state:packet.action==='unknown'?'error':'success',reason:'unsupported_action'})}),0);
  }
  close() {this.readyState=3;this.onclose?.();}
}
(globalThis as any).WebSocket=Socket;
const {sodabotTransport:t}=await import('./sodabotTransport');
saved.set('sodabot_connected','true');
assert.equal(t.type,'none','saved flag is not a live connection');
await Promise.all([t.connectWifi('192.168.0.22'), t.connectWifi('192.168.0.22')]);
assert.equal(Socket.instances.length,1,'simultaneous callers share a socket');
await t.send('set_expression','happy');
assert.equal(Socket.instances[0].sent.length,1,'one command sent once');
assert.equal(Socket.instances[0].sent[0].value,'happy');
await assert.rejects(t.send('unknown'),/unsupported_action/);
Socket.instances[0].close();
assert.equal(t.type,'none','closed socket clears live state');
await t.send('send_message','안녕');
assert.equal(Socket.instances.length,2,'disconnected send reconnects');
assert.equal(Socket.instances[1].sent[0].value,'안녕');
t.disconnect();
const device:any=new EventTarget();device.gatt={connected:true,disconnect(){this.connected=false;device.dispatchEvent(new Event('gattserverdisconnected'));}};
const notify:any=new EventTarget();
const writes:Uint8Array[]=[];let collected:number[]=[];
const write={async writeValueWithResponse(bytes:Uint8Array) {
  assert.ok(bytes.length<=20);writes.push(bytes);collected.push(...bytes);
  if(bytes[bytes.length-1]===10) {
    const packet=JSON.parse(new TextDecoder().decode(new Uint8Array(collected)));collected=[];
    assert.equal(packet.value,'한글 텍스트 전송 '.repeat(8));
    const reply=new TextEncoder().encode(JSON.stringify({id:packet.id,state:'success'})+'\n');
    for(let i=0;i<reply.length;i+=20){notify.value=new DataView(reply.slice(i,i+20).buffer);notify.dispatchEvent(new Event('characteristicvaluechanged'));}
  }
}};
t.attachBle(device,write,notify);
await t.send('send_message','한글 텍스트 전송 '.repeat(8));
assert.ok(writes.length>2,'long UTF-8 BLE payload is split');
await assert.rejects(t.send('send_message','가'.repeat(500)),/너무 깁니다/);
t.disconnect();assert.equal(t.type,'none');
console.log('PASS: live status, single socket/send, ACK errors, reconnect, BLE UTF-8 chunking/reassembly, size limit, disconnect');
