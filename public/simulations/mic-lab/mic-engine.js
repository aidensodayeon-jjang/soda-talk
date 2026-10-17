import {group,topPins,bottomPins} from '../lcd-lab/engine.js';
export const micPins=['VDD','GND','SD','WS','SCK','L/R'];
export const micConnections=[
 ['pin:3V3','P2','ESP32 3V3 → 왼쪽 + 레일','#ef4444'],
 ['mic:VDD','P4','VDD → 왼쪽 + 레일 (3.3V)','#ef4444'],
 ['mic:GND','N5','GND → 상단 − 레일','#334155'],
 ['mic:L/R','N6','L/R → 상단 − 레일 (왼쪽 채널)','#64748b'],
 ['mic:SCK','pin:9','SCK → GPIO9','#22a69b'],
 ['mic:WS','pin:10','WS → GPIO10','#f59e0b'],
 ['mic:SD','pin:8','SD → GPIO8','#8b5cf6'],
];
export function micWiring(s){
 if(!s.mic)return {ok:false,message:'INMP441 마이크를 브레드보드에 배치하세요.',missing:micPins};
 if(!s.board)return {ok:false,message:'ESP32가 필요합니다.'};
 const parent=new Map();
 function root(id){id=group(id,s.split);if(!parent.has(id))parent.set(id,id);let p=id;while(parent.get(p)!==p)p=parent.get(p);return p;}
 const join=(a,b)=>parent.set(root(a),root(b));
 for(const w of s.wires)join(w.a,w.b);
 topPins.forEach((p,i)=>join('pin:'+p,'E'+(s.board.row+i)));
 bottomPins.forEach((p,i)=>join('pin:'+p,'F'+(s.board.row+i)));
 const same=(a,b)=>root(a)===root(b);
 if(same('pin:3V3','pin:5V')||same('pin:3V3','pin:GND')||same('pin:5V','pin:GND'))return {ok:false,message:'전원 단락: 3.3V·5V·GND를 분리하세요.',danger:true};
 for(const pin of micPins)if(same('mic:'+pin,'pin:5V'))return {ok:false,message:'5V 연결 오류: 마이크는 3.3V 전원을 사용합니다.',danger:true};
 const expected={VDD:'pin:3V3',GND:'pin:GND','L/R':'pin:GND',SCK:'pin:9',WS:'pin:10',SD:'pin:8'};
 const missing=Object.entries(expected).filter(([pin,target])=>!same('mic:'+pin,target)).map(([pin])=>pin);
 if(missing.length)return {ok:false,message:'미연결 또는 잘못된 연결: '+missing.join(' · '),missing};
 for(const pin of ['SCK','WS','SD'])for(const other of ['VDD','GND','L/R','SCK','WS','SD']){
  if(pin!==other&&same('mic:'+pin,'mic:'+other))return {ok:false,message:`신호선 단락: ${pin} ↔ ${other}`,danger:true};
 }
 return {ok:true,message:'마이크 배선 정상 · 3.3V / 왼쪽 채널',missing:[]};
}
export function simulatedLevel(input,pressed,time=0){
 if(!pressed)return 0;
 return Math.max(0,Math.min(100,Math.round(Number(input)*(.7+.3*Math.sin(time/180)))));
}
