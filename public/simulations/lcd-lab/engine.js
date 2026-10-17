export const topPins=['7','6','5','4','3','2','1','RX','TX'];
export const bottomPins=['8','9','10','11','12','13','3V3','GND','5V'];
export function group(id,split=false){
 const m=/^([A-J])(\d+)$/.exec(id); if(m)return `${m[1]<'F'?'upper':'lower'}:${m[2]}`;
 const r=/^(P|N)(\d+)$/.exec(id); if(r)return `${r[1]}:${split&&Number(r[2])>15?2:1}`;
 return id;
}
export function validate(s){
 const parent=new Map(); const root=x=>{x=group(x,s.split);if(!parent.has(x))parent.set(x,x);let y=x;while(parent.get(y)!==y)y=parent.get(y);return y;};
 const join=(a,b)=>{parent.set(root(a),root(b));};
 for(const w of s.wires)join(w.a,w.b);
 if(s.board){topPins.forEach((p,i)=>join('pin:'+p,'E'+(s.board.row+i)));bottomPins.forEach((p,i)=>join('pin:'+p,'F'+(s.board.row+i)));}
 const same=(a,b)=>root(a)===root(b);
 const grounds=['pin:GND']; const powers=['pin:5V','pin:3V3'];
 if(powers.some(p=>grounds.some(g=>same(p,g))||same(p,'pin:2'))||same('pin:2','pin:GND'))return {ok:false,kind:'short',message:'단락 위험: 전원 또는 GPIO가 GND에 직접 연결되어 있어요.'};
 if(!s.board||!s.led)return {ok:false,kind:'open',message:'보드와 LED를 브레드보드에 배치하세요.'};
 const edges=[];
 if(s.resistor)edges.push({a:root(s.resistor.a),b:root(s.resistor.b),type:'resistor'});
 edges.push({a:root(s.led.a),b:root(s.led.b),type:'led'});
 function paths(start,end){end=root(end);const found=[];function visit(n,seen,route){if(n===end){found.push(route);return;}for(const e of edges){const next=e.a===n?e.b:e.b===n?e.a:null;if(next&&!seen.has(next))visit(next,new Set([...seen,next]),[...route,{...e,forward:e.a===n}]);}}visit(root(start),new Set([root(start)]),[]);return found;}
 if(powers.some(p=>paths(p,'pin:GND').some(route=>route.some(e=>e.type==='led'))))return {ok:false,kind:'power',message:'이번 미션은 전원 핀이 아닌 GPIO2로 LED를 제어하세요.'};
 const routes=paths('pin:2','pin:GND');
 const complete=routes.find(p=>p.some(e=>e.type==='led')&&p.some(e=>e.type==='resistor'));
 if(complete){if(!complete.find(e=>e.type==='led').forward)return {ok:false,kind:'polarity',message:'LED 극성이 반대예요. 긴 다리(+)에서 짧은 다리(−)로 흐르게 해보세요.'};
 if(same(s.led.a,s.led.b)||same(s.resistor.a,s.resistor.b))return {ok:false,kind:'short',message:'부품 양쪽 다리가 같은 연결망에 있어 우회돼요.'};
 return {ok:true,kind:'ok',message:'정상 회로! GPIO2와 GND 사이에 저항과 LED가 직렬로 연결됐어요.'};}
 if(routes.some(p=>p.some(e=>e.type==='led')))return {ok:false,kind:'resistor',message:'저항이 없거나 우회돼요. LED와 직렬로 저항을 연결하세요.'};
 if(topPins.concat(bottomPins).filter(p=>!['2','GND','5V','3V3'].includes(p)).some(p=>paths('pin:'+p,'pin:GND').some(r=>r.some(e=>e.type==='led'))))return {ok:false,kind:'gpio',message:'GPIO 번호를 확인하세요. 이번 미션은 GPIO2를 사용해요.'};
 return {ok:false,kind:'open',message:'회로가 끊어졌어요. GND 경로, 구멍 번호, 중앙 홈 양쪽의 분리를 확인하세요.'};
}
export function compile(source){
 let code=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');const vars={};
 code=code.replace(/(?:const\s+)?(?:int|long|unsigned\s+long)\s+(\w+)\s*=\s*(\d+)\s*;/g,(_,k,v)=>{vars[k]=Number(v);return '';});
 const blocks={};code=code.replace(/void\s+(setup|loop)\s*\(\s*\)\s*\{([^{}]*)\}/g,(_,name,body)=>{if(blocks[name]!==undefined)throw Error(name+'()가 중복됐어요.');blocks[name]=body;return '';});
 if(code.trim()||blocks.setup===undefined||blocks.loop===undefined)throw Error('setup(), loop()와 정수 변수, pinMode, digitalWrite, delay만 지원해요.');
 const value=x=>{x=x.trim();if(/^\d+$/.test(x))return Number(x);if(x in vars)return vars[x];throw Error('알 수 없는 정수: '+x);};
 const parse=body=>body.split(';').map(x=>x.trim()).filter(Boolean).map(stmt=>{let m=/^(pinMode|digitalWrite|delay)\s*\(([^()]*)\)$/.exec(stmt);if(!m)throw Error('지원하지 않는 문법: '+stmt);const args=m[2].split(',').map(x=>x.trim());if(m[1]==='delay'){if(args.length!==1)throw Error('delay에는 시간 하나가 필요해요.');const ms=value(args[0]);if(ms<1||ms>60000)throw Error('delay는 1~60000ms로 입력하세요.');return {op:'delay',ms};}if(args.length!==2||!(m[1]==='pinMode'?['OUTPUT']:['HIGH','LOW']).includes(args[1]))throw Error('명령의 인수를 확인하세요: '+stmt);const pin=value(args[0]);if(!topPins.concat(bottomPins).includes(String(pin)))throw Error('지원하지 않는 GPIO: '+pin);return {op:m[1],pin,value:args[1]};});
 return {setup:parse(blocks.setup),loop:parse(blocks.loop)};
}
export function createRuntime(program){let setup=true,index=0,waitUntil=0;const outputs=new Set(),pins={};return {pins,tick(now){let count=0;while(now>=waitUntil&&count++<500){const list=setup?program.setup:program.loop;if(index>=list.length){if(setup){setup=false;index=0;continue;}index=0;break;}const cmd=list[index++];if(cmd.op==='delay'){waitUntil=now+cmd.ms;break;}if(cmd.op==='pinMode')outputs.add(cmd.pin);if(cmd.op==='digitalWrite'){if(!outputs.has(cmd.pin))throw Error('GPIO'+cmd.pin+'를 pinMode(..., OUTPUT)으로 먼저 설정하세요.');pins[cmd.pin]=cmd.value==='HIGH';}}return pins;}};}
