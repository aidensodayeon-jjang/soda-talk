import {group,topPins,bottomPins} from './engine.js';
export function soundWiring(s){
 if(!s.amp||!s.speaker)return {ok:false,message:'I2S 앰프와 스피커를 배치하세요.'};
 const parent=new Map();const root=id=>{id=group(id,s.split);if(!parent.has(id))parent.set(id,id);while(parent.get(id)!==id)id=parent.get(id);return id;};const join=(a,b)=>parent.set(root(a),root(b));
 s.wires.forEach(w=>join(w.a,w.b));join('pin:44','pin:RX');if(s.board){topPins.forEach((p,i)=>join('pin:'+p,'E'+(s.board.row+i)));bottomPins.forEach((p,i)=>join('pin:'+p,'F'+(s.board.row+i)));}
 const same=(a,b)=>root(a)===root(b);
 if(same('pin:5V','pin:GND')||same('amp:OUTP','amp:OUTN'))return {ok:false,message:'단락 위험: 전원 또는 앰프 출력 두 단자를 분리하세요.'};
 const connections=[['amp:VDD','pin:5V'],['amp:GND','pin:GND'],['amp:BCLK','pin:5'],['amp:LRC','pin:3'],['amp:DIN','pin:44'],['amp:OUTP','speaker:plus'],['amp:OUTN','speaker:minus']];
 const missing=connections.find(([a,b])=>!same(a,b));return missing?{ok:false,message:'연결 확인: '+missing.join(' → ')}:{ok:true,message:'스피커 회로 정상'};
}
export function compileTones(source,template){
 const clean=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'');
 const pattern=/playTone\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+)\s*\)\s*;/g;
 const tones=[...source.matchAll(pattern)].map(m=>({frequency:Number(m[1]),duration:Number(m[2])}));
 if(clean(source.replace(pattern,''))!==clean(template.replace(pattern,'')))throw Error('이 실습은 soda-1-1.ino의 playTone(주파수, 시간) 편집을 지원해요. 다른 C++/I2S 변경은 Arduino IDE에서 실행하세요.');
 if(!tones.length||tones.length>100||tones.some(t=>t.frequency<20||t.frequency>20000||t.duration<1||t.duration>10000))throw Error('주파수 20~20000Hz, 시간 1~10000ms, 최대 100개 음표를 입력하세요.');
 return tones;
}
export function buttonHoles(button){
 const letters='ABCDEFGHIJ',ys=[115,135,155,175,195,265,285,305,325,345];
 let index=0;ys.forEach((y,i)=>{if(Math.abs(y-(button.y+20))<Math.abs(ys[index]-(button.y+20)))index=i;});
 const hole=x=>letters[index]+Math.max(1,Math.min(30,Math.round((x-65)/26)+1));
 return {a:hole(button.x-26),b:hole(button.x+26)};
}
export function buttonStatus(s){
 if(!s.button)return {ok:false,message:'버튼을 배치하세요.'};
 const edges=new Map();const add=(a,b)=>{a=group(a,s.split);b=group(b,s.split);if(!edges.has(a))edges.set(a,[]);if(!edges.has(b))edges.set(b,[]);edges.get(a).push(b);edges.get(b).push(a);};
 s.wires.forEach(w=>add(w.a,w.b));topPins.forEach((p,i)=>add('pin:'+p,'E'+(s.board.row+i)));bottomPins.forEach((p,i)=>add('pin:'+p,'F'+(s.board.row+i)));
 const holes=buttonHoles(s.button);add('button:a',holes.a);add('button:b',holes.b);
 const connected=(a,b)=>{const seen=new Set(),todo=[group(a,s.split)];while(todo.length){const n=todo.pop();if(n===group(b,s.split))return true;if(seen.has(n))continue;seen.add(n);todo.push(...(edges.get(n)||[]));}return false;};
 if(connected('button:a','button:b'))return {ok:false,message:'버튼의 양쪽 다리가 같은 연결망에 있어요. 서로 분리된 구멍에 꽂으세요.'};
 const a4=connected('button:a','pin:4'),b4=connected('button:b','pin:4');
 if(!a4&&!b4)return {ok:false,message:'버튼 다리가 꽂힌 '+holes.a+' 또는 '+holes.b+'를 GPIO4에 연결하세요.'};
 const groundSide=a4?'button:b':'button:a';
 if(!connected(groundSide,'pin:GND'))return {ok:false,message:connected(groundSide,'N1')||connected(groundSide,'N30')?'버튼은 파란 레일에 연결됐지만 레일이 GND와 연결되지 않았어요. 파란 레일 → ESP32 GND 점퍼선을 추가하세요.':'버튼 반대쪽 다리를 ESP32 GND에 연결하세요.'};
 return {ok:true,message:'버튼을 누르고 있으면 LED가 켜집니다.'};
}
export function buttonConnected(s){return buttonStatus(s).ok;}
