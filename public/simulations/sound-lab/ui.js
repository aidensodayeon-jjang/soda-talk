import {soundWiring,compileTones,buttonConnected,buttonStatus,buttonHoles} from './sound-engine.js';
import {topPins,bottomPins,group,validate,compile,createRuntime} from './engine.js';
const firmwareTemplate="#include <driver/i2s.h>\n#include <math.h>\n\n// ========================\n// \uc2a4\ud53c\ucee4 \ud540 \uc124\uc815\n// ========================\n#define I2S_BCLK  5\n#define I2S_LRC   3\n#define I2S_DOUT  44\n\n#define I2S_PORT I2S_NUM_0\n#define SAMPLE_RATE 44100\n\n\n// ========================\n// \uc18c\ub9ac \ub0b4\uae30 \ud568\uc218\n// \uc218\uc815\ud558\uc9c0 \ub9c8\uc138\uc694\n// ========================\nvoid playTone(float freq, int duration) {\n\n  int samples = SAMPLE_RATE * duration / 1000;\n  int16_t buffer[2];\n\n  for (int i = 0; i < samples; i++) {\n\n    int16_t sound =\n      sin(2 * PI * freq * i / SAMPLE_RATE) * 6000;\n\n    buffer[0] = sound;\n    buffer[1] = sound;\n\n    size_t written;\n\n    i2s_write(\n      I2S_PORT,\n      buffer,\n      sizeof(buffer),\n      &written,\n      portMAX_DELAY\n    );\n  }\n\n  i2s_zero_dma_buffer(I2S_PORT);\n}\n\n\n// ========================\n// \ucc98\uc74c \ud55c \ubc88 \uc2e4\ud589\n// ========================\nvoid setup() {\n\n  // I2S \uc124\uc815\n  i2s_config_t i2s_config = {\n\n    .mode = (i2s_mode_t)(\n      I2S_MODE_MASTER |\n      I2S_MODE_TX\n    ),\n\n    .sample_rate = SAMPLE_RATE,\n    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,\n\n    .channel_format =\n      I2S_CHANNEL_FMT_RIGHT_LEFT,\n\n    .communication_format =\n      I2S_COMM_FORMAT_STAND_I2S,\n\n    .intr_alloc_flags = 0,\n    .dma_buf_count = 8,\n    .dma_buf_len = 256,\n    .use_apll = false,\n    .tx_desc_auto_clear = true,\n    .fixed_mclk = 0\n  };\n\n\n  // \ud540 \uc5f0\uacb0\n  i2s_pin_config_t pin_config = {\n\n    .bck_io_num = I2S_BCLK,\n    .ws_io_num = I2S_LRC,\n    .data_out_num = I2S_DOUT,\n    .data_in_num = I2S_PIN_NO_CHANGE\n  };\n\n\n  i2s_driver_install(\n    I2S_PORT,\n    &i2s_config,\n    0,\n    NULL\n  );\n\n  i2s_set_pin(\n    I2S_PORT,\n    &pin_config\n  );\n\n\n  // ==================================\n  // \ud83c\udfb5 \ud559\uc0dd \uc2e4\uc2b5 : \uc5ec\uae30\ub9cc \uc218\uc815\ud558\uc138\uc694!\n  // ==================================\n\n  playTone(262, 200);   // \ub3c4\n  playTone(294, 200);   // \ub808\n  playTone(330, 200);   // \ubbf8\n  playTone(349, 200);   // \ud30c\n  playTone(392, 200);   // \uc194\n  playTone(440, 200);   // \ub77c\n  playTone(494, 200);   // \uc2dc\n  playTone(523, 500);   // \ub192\uc740 \ub3c4\n\n  // ==================================\n}\n\n\n// \ubc18\ubcf5 \uc2e4\ud589 \uc5c6\uc74c\nvoid loop() {\n\n}\n";
const buttonCode="void setup() {\n  pinMode(2, OUTPUT);\n  pinMode(4, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(4) == LOW) {\n    digitalWrite(2, HIGH);\n  }\n  else {\n    digitalWrite(2, LOW);\n  }\n}";
const $=id=>document.getElementById(id),svg=$('workspace');
const ledStarter=()=>({
 led:{a:'A20',b:'A21',color:'#ff4545'},
 resistor:{a:'A17',b:'A20',ohms:220},
 wires:[{a:'pin:2',b:'B17',color:'#f2a82d'},{a:'B21',b:'pin:GND',color:'#475569'}]
});
const initial=()=>({version:1,started:false,breadboard:true,board:{row:22},amp:null,speaker:null,button:null,split:false,usb:true,code:buttonCode,hints:0,errors:0,circuitSuccess:true,simulationSuccess:false,completedAt:null,...ledStarter()});
const session=localStorage.getItem('authSessionId')||'guest';const key='soda-sound-lab:'+session;
let s=initial();
try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===1)s={...s,...saved};}catch{}
// Every entry to 2-3 starts with the completed LED circuit, independently of 2-2 work.
const starter=ledStarter();
s.led=starter.led;s.resistor=starter.resistor;
s.wires=[...(Array.isArray(s.wires)?s.wires:[]).filter(w=>[w.a,w.b].some(id=>/^(amp|speaker|button):/.test(id))),...starter.wires];
if(!s.buttonCodeVersion){s.code=buttonCode;s.buttonCodeVersion=1;}
s.breadboard=true;s.board={row:22};s.usb=true;s.split=false;s.circuitSuccess=true;
for(const part of ['button','amp','speaker'])if(s[part])Object.assign(s[part],snapModule(s[part].x,s[part].y));
let tool='',selected='',pending='',hover='',runtime=null,timer=null,lit=false,zoom=1,pan={x:0,y:0},drag=null,wireEdit=null;
function save(){try{localStorage.setItem(key,JSON.stringify(s));$('saved').textContent='이 기기에 저장됨';}catch{$('saved').textContent='저장 실패 · 결과를 내려받으세요';}if(false)fetch('/api/circuit-progress',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session},body:JSON.stringify(s)}).then(r=>{if(r.ok)$('saved').textContent='학습 결과 저장됨';}).catch(()=>{});}
function xy(id){if(id==='pin:44')return [855,170];const [module,pin]=id.split(':');if(module==='button'&&s.button)return xy(buttonHoles(s.button)[pin]);if(['amp','speaker','button'].includes(module)&&s[module]){const offsets={amp:{VDD:[-34,-25],GND:[-34,-10],BCLK:[-34,5],LRC:[-34,20],DIN:[-34,35],OUTP:[34,-4],OUTN:[34,14]},speaker:{plus:[-25,25],minus:[25,25]},button:{a:[-18,18],b:[18,18]}};const o=offsets[module][pin];return [s[module].x+o[0],s[module].y+o[1]];}const m=/^([A-JPN])(\d+)$/.exec(id);if(m){const row=Number(m[2]);const ys={P:55,N:75,A:115,B:135,C:155,D:175,E:195,F:265,G:285,H:305,I:325,J:345};return [65+(row-1)*26,ys[m[1]]];}if(id.startsWith('pin:')&&s.board){let i=topPins.indexOf(id.slice(4));return xy((i>=0?'E':'F')+(s.board.row+(i>=0?i:bottomPins.indexOf(id.slice(4)))));}return [0,0];}
function esc(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function line(a,b,color,width=3,extra=''){const [x,y]=xy(a),[u,v]=xy(b);return `<path pointer-events="stroke" d="M${x},${y} Q${(x+u)/2},${Math.min(y,v)-40} ${u},${v}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" fill="none" ${extra}/>`;}
function render(){let h=`<defs>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#667080"/><stop offset=".3" stop-color="#f6f8fc"/><stop offset=".55" stop-color="#b4bfcb"/><stop offset="1" stop-color="#637183"/></linearGradient>
<linearGradient id="ledGlass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffbbb9"/><stop offset=".25" stop-color="#fa5357"/><stop offset=".7" stop-color="#d01d34"/><stop offset="1" stop-color="#7e1029"/></linearGradient>
<radialGradient id="ledLight" cx=".4" cy=".35"><stop stop-color="#fff9db"/><stop offset=".35" stop-color="#ffb47b"/><stop offset="1" stop-color="#ff3548"/></radialGradient>
<linearGradient id="resistorBody" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bca477"/><stop offset=".3" stop-color="#fff0c9"/><stop offset=".65" stop-color="#e4cb98"/><stop offset="1" stop-color="#ae9060"/></linearGradient>
<linearGradient id="plastic" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#141c29"/><stop offset=".45" stop-color="#4f5d70"/><stop offset="1" stop-color="#182131"/></linearGradient>
<linearGradient id="boardPlastic" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#eef0f4"/></linearGradient>
<filter id="componentShadow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="1" dy="3" stdDeviation="2" flood-color="#18263b" flood-opacity=".25"/></filter>
</defs>`+'<g transform="translate('+pan.x+' '+pan.y+') scale('+zoom+')">';if(s.breadboard){h+='<rect x="30" y="30" width="835" height="355" rx="18" fill="url(#boardPlastic)" stroke="#cdd2df"/><rect x="45" y="214" width="805" height="28" rx="6" fill="#e8ebf1"/>';h+='<path d="M57 42H830" stroke="#e75257" stroke-width="2.5"/><path d="M57 86H830" stroke="#3885db" stroke-width="2.5"/><text x="43" y="59" fill="#dc3544" font-size="15" font-weight="700">+</text><text x="43" y="79" fill="#2676cc" font-size="17" font-weight="700">−</text>';for(const letter of 'P N A B C D E F G H I J'.split(' ')){const y=xy(letter+'1')[1];if(!['P','N'].includes(letter))h+=`<text x="43" y="${y+4}" font-size="10" fill="#7d8596">${letter}</text>`;for(let row=1;row<=30;row++){const id=letter+row,[x,y]=xy(id);const active=false&&hover&&group(id,s.split)===group(hover,s.split);h+=`<circle data-node="${id}" cx="${x}" cy="${y}" r="${pending===id?7:5}" fill="${active?'#a9a5ff':pending===id?'#6366f1':'#bfc6d3'}"/><circle cx="${x}" cy="${y}" r="2" fill="#667085" pointer-events="none"/>`;if(letter==='A')h+=`<text x="${x-5}" y="100" font-size="9" fill="#9299a8">${row}</text>`;}}}
if(s.board){const [x]=xy('E'+s.board.row);h+=`<g data-fixed="board"><rect x="${x-12}" y="202" width="232" height="56" rx="8" fill="#202938" stroke="#111827" stroke-width="3"/><rect x="${x+45}" y="213" width="75" height="34" rx="4" fill="#7b8493"/><text x="${x+49}" y="233" fill="white" font-size="9">ESP32-S3</text><rect x="${x+205}" y="215" width="25" height="29" rx="4" fill="#c6cbd2"/></g>`;[topPins,bottomPins].forEach((pins,j)=>pins.forEach((p,i)=>{const [u,v]=xy('pin:'+p);h+=`<circle data-node="pin:${p}" cx="${u}" cy="${v}" r="7" fill="#d7b76c"/><text x="${u-5}" y="${v+(j?18:-12)}" font-size="10" fill="#414b60">${p}</text>`;}));}
s.wires.forEach((w,i)=>{
 const color=selected==='wire:'+i?'#f59e0b':w.color;
 h+=line(w.a,w.b,'transparent',20,`data-wire="${i}"`);
 h+=line(w.a,w.b,'#263248',7,`data-wire="${i}" opacity=".25" transform="translate(1 3)"`);
 h+=line(w.a,w.b,color,6,`data-wire="${i}"`);
 h+=line(w.a,w.b,'#fff',1.5,`data-wire="${i}" opacity=".38" transform="translate(0 -1)"`);
 for(const id of [w.a,w.b]){const [x,y]=xy(id);h+=`<g data-wire="${i}"><path d="M${x} ${y-7}v7" stroke="url(#metal)" stroke-width="3"/><rect x="${x-4}" y="${y-17}" width="8" height="12" rx="2" fill="url(#plastic)"/><path d="M${x-2} ${y-15}v7" stroke="#94a1b2" stroke-width=".7" opacity=".5"/></g>`;}
});
for(const part of ['resistor','led'])if(s[part]){
 const p=s[part],[x,y]=xy(p.a),[u,v]=xy(p.b),cx=(x+u)/2,cy=(y+v)/2;
 h+=`<g data-part="${part}">`;
 if(part==='led'){
 h+=`<path d="M${x} ${y}L${cx-6} ${cy-7}v-13M${u} ${v}L${cx+6} ${cy-7}v-13" stroke="#798695" stroke-width="3" fill="none"/><path d="M${x-0.5} ${y}L${cx-6.5} ${cy-7}v-13M${u-0.5} ${v}L${cx+5.5} ${cy-7}v-13" stroke="#e9edf2" stroke-width="1" fill="none"/>`;
 if(lit)h+=`<ellipse cx="${cx}" cy="${cy-24}" rx="26" ry="28" fill="${p.color}" opacity=".16" style="filter:blur(7px)"/>`;
 h+=`<g filter="url(#componentShadow)"><path d="M${cx-11} ${cy-14}v-16a11 11 0 0 1 22 0v16z" fill="url(#${lit?'ledLight':'ledGlass'})" stroke="#b52b3d" stroke-width=".8"/><ellipse cx="${cx}" cy="${cy-14}" rx="14" ry="4" fill="#df3d4c" stroke="#a72436" stroke-width=".8"/><path d="M${cx-5} ${cy-17}v-12h10v12" stroke="#ac6670" stroke-width="1.5" fill="none" opacity=".6"/><path d="M${cx-7} ${cy-26}v-4a7 7 0 0 1 5-7" stroke="#fff" stroke-width="3" opacity=".65" fill="none" stroke-linecap="round"/><ellipse cx="${cx+5}" cy="${cy-30}" rx="2" ry="5" fill="#fff" opacity=".17"/></g>`;
 }else{
 const angle=Math.atan2(v-y,u-x)*180/Math.PI;
 h+=`<line x1="${x}" y1="${y}" x2="${u}" y2="${v}" stroke="#7c8899" stroke-width="3"/><line x1="${x}" y1="${y-1}" x2="${u}" y2="${v-1}" stroke="#eff2f7" stroke-width="1"/><g transform="translate(${cx} ${cy}) rotate(${angle})" filter="url(#componentShadow)"><path d="M-24 -6Q-24 -10 -18 -10L-11 -7H11L18 -10Q24 -10 24 -6V6Q24 10 18 10L11 7H-11L-18 10Q-24 10 -24 6Z" fill="url(#resistorBody)" stroke="#b1986c" stroke-width=".8"/><path d="M-15 -8V8M-7 -7V7" stroke="#b53d35" stroke-width="4"/><path d="M2 -7V7" stroke="#70462d" stroke-width="4"/><path d="M17 -9V9" stroke="#bb9135" stroke-width="3"/><path d="M-19 -6H19" stroke="#fff" stroke-width="1.5" opacity=".3"/></g>`;
 }
 if(selected===part)h+=`<ellipse cx="${cx}" cy="${cy-(part==='led'?23:0)}" rx="${part==='led'?18:29}" ry="${part==='led'?25:15}" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="3 3"/>`;
 h+='</g>';
 for(const [n,id]of [['a',p.a],['b',p.b]]){const [px,py]=xy(id);h+=`<circle data-node="${part}:${n}" cx="${px}" cy="${py}" r="5" fill="url(#metal)" stroke="#667384"/><text x="${px-4}" y="${py+17}" font-size="11" fill="${n==='a'?'#d34748':'#53657b'}">${part==='led'?(n==='a'?'+':'−'):''}</text>`;}
}
// Keep terminals above wire hit areas so a crossing wire cannot steal a hole click.
h+=renderSoundParts();
const targets=[...h.matchAll(/<circle data-node="([^"]+)" cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)];
for(const m of targets)h+=`<circle data-node="${m[1]}" cx="${m[2]}" cy="${m[3]}" r="7" fill="transparent"/>`;
if(timer&&s.button){const {x,y}=s.button;h+=`<circle data-press="button" cx="${x}" cy="${y-3}" r="17" fill="transparent" style="cursor:pointer"/>`;}
if(pending){const [px,py]=xy(resolve(pending));h+=`<circle cx="${px}" cy="${py}" r="11" fill="none" stroke="#6366f1" stroke-width="3" pointer-events="none"/><text x="${px+14}" y="${py-14}" font-size="13" fill="#5145cd">① ${esc(pending)}</text>`;}h+='</g>';svg.innerHTML=h;
const activeWire=selected.startsWith('wire:')?s.wires[Number(selected.slice(5))]:null;
$('wireList').innerHTML=s.wires.length?s.wires.map((w,i)=>`<button data-select-wire="${i}" class="${selected==='wire:'+i?'active':''}"><span style="color:${esc(w.color)}">●</span> 선 ${i+1} · ${esc(w.a)} → ${esc(w.b)}</button>`).join(''):'<span>연결한 점퍼선이 여기에 표시돼요.</span>';
$('wireSelection').hidden=!activeWire;
if(activeWire)$('wireName').textContent=`${activeWire.a} → ${activeWire.b}`;
$('wireGuide').textContent=tool==='resistor'?(pending?'② 저항의 두 번째 다리를 꽂을 구멍을 클릭하세요.':'① 저항의 첫 번째 다리를 꽂을 구멍을 클릭하세요.'):tool==='led'?'놓을 구멍을 클릭하세요.':wireEdit?'새 구멍이나 핀을 클릭하면 선택한 끝점이 이동해요.':tool==='lead'?'① LED/저항의 다리 클릭 → ② 새 구멍 클릭':pending?`① ${pending} 선택됨 → ② 도착 구멍이나 핀을 클릭하세요`:tool==='wire'?'① 시작 핀 클릭 → ② 도착 구멍 클릭':'부품 몸체·다리를 드래그해서 이동 · 배선은 점퍼선 버튼 선택';
$('cancelWire').disabled=!pending&&!wireEdit&&tool!=='lead';
document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('tool').textContent=tool?'선택: '+({led:'LED',resistor:'저항',wire:'점퍼선'}[tool]||tool)+' · 구멍을 클릭하세요':pending?'다음 연결점을 선택하세요':tool==='wire'?'점퍼선: 두 단자를 클릭하세요':'부품을 드래그해서 배치하세요';}
const icons={
 led:`<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M19 25v12m10-12v9" stroke="#8b95a5" stroke-width="3"/><path d="M14 24V16a10 10 0 0 1 20 0v8z" fill="#ff5a63" stroke="#dc3647" stroke-width="1.5"/><path d="M18 16a6 6 0 0 1 4-6" fill="none" stroke="#ffb7bb" stroke-width="2.5" stroke-linecap="round"/><path d="M12 25h24" stroke="#dc3647" stroke-width="3" stroke-linecap="round"/></svg>`,
 resistor:`<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M2 20h44" stroke="#8b95a5" stroke-width="2.5"/><rect x="10" y="13" width="28" height="14" rx="5" fill="#e5cca0" stroke="#c6a979"/><path d="M16 14v12" stroke="#b34438" stroke-width="3"/><path d="M22 14v12" stroke="#b34438" stroke-width="3"/><path d="M28 14v12" stroke="#785438" stroke-width="3"/><path d="M34 14v12" stroke="#c59b37" stroke-width="2"/></svg>`,
 wire:`<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M9 29V15Q9 6 24 8t15 17v4" fill="none" stroke="#7164e8" stroke-width="4" stroke-linecap="round"/><path d="M9 28v9m30-9v9" stroke="#9aa3b1" stroke-width="2.5"/><path d="M9 25v6m30-6v6" stroke="#30394d" stroke-width="6"/></svg>`
};
icons.amp='<svg viewBox="0 0 48 40" aria-hidden="true"><rect x="9" y="4" width="30" height="32" rx="3" fill="#2771a5"/><rect x="19" y="14" width="10" height="12" fill="#263243"/><path d="M13 8v24m22-24v24" stroke="#dab96c" stroke-width="3" stroke-dasharray="2 4"/></svg>';icons.speaker='<svg viewBox="0 0 48 40" aria-hidden="true"><circle cx="24" cy="20" r="17" fill="#333"/><circle cx="24" cy="20" r="12" fill="#555"/><circle cx="24" cy="20" r="6" fill="#262626"/></svg>';icons.button='<svg viewBox="0 0 48 40" aria-hidden="true"><rect x="10" y="6" width="28" height="28" rx="3" fill="#b9bec4" stroke="#697282"/><circle cx="24" cy="20" r="9" fill="#262d37"/></svg>';
const parts=[['button','버튼'],['amp','I2S 앰프'],['speaker','스피커'],['led','LED'],['resistor','저항'],['wire','점퍼선']];
$('library').innerHTML=parts.map(([id,label])=>`<button draggable="true" data-tool="${id}">${icons[id]}<span>${label}</span></button>`).join('');
$('library').onclick=e=>{const button=e.target.closest('[data-tool]');if(!button)return;tool=button.dataset.tool;pending='';wireEdit=null;selected='';render();};
$('library').ondragstart=e=>{const button=e.target.closest('[data-tool]');if(!button)return;tool=button.dataset.tool;e.dataTransfer.setData('text/plain',tool);};
function snapModule(x,y){
 const id=nearest(Math.max(117,Math.min(767,x)),Math.max(135,Math.min(325,y)));
 const [sx,sy]=xy(id);return {x:sx,y:sy};
}
function nearest(x,y){let best='',distance=Infinity;for(const c of 'ABCDEFGHIJ')for(let r=1;r<=30;r++){const [u,v]=xy(c+r),d=Math.hypot(x-u,y-v);if(d<distance){distance=d;best=c+r;}}return best;}
function position(e){const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(svg.getScreenCTM().inverse());return {x:(p.x-pan.x)/zoom,y:(p.y-pan.y)/zoom};}
function place(id){if(!/^[A-JPN]\d+$/.test(id))return;if(!s.breadboard){$('log').textContent='브레드보드를 먼저 준비하세요.';return;}if(tool==='led'){s.led={a:id,b:id[0]+Math.min(30,Number(id.slice(1))+1),color:'#ff4545'};tool='';}else if(tool==='resistor'){if(!pending){pending=id;render();return;}if(pending===id){$('log').textContent='두 번째 다리는 다른 구멍을 선택하세요.';return;}s.resistor={a:pending,b:id,ohms:220};pending='';selected='resistor';tool='';}changed();}
function resolve(id){const [p,n]=id.split(':');return ['led','resistor'].includes(p)?s[p][n]:id;}
function changed(){s.circuitSuccess=validate(s).ok;save();render();}
svg.onclick=e=>{
 const part=e.target.closest('[data-part]')?.dataset.part,wire=e.target.closest('[data-wire]')?.dataset.wire,id=e.target.dataset.node;
 if(['amp','speaker','button'].includes(tool)){const point=position(e);s[tool]=snapModule(point.x,point.y);selected=tool;tool='';changed();return;}
 if(['led','resistor'].includes(tool)){const point=position(e);place(id?resolve(id):nearest(point.x,point.y));return;}
 if(wire!==undefined){selected='wire:'+wire;pending='';wireEdit=null;tool='';render();return;}
 if(part){selected=part;pending='';render();return;}
 if(!id)return;
 if(wireEdit){const w=s.wires[wireEdit.index],target=resolve(id);if(target===w[wireEdit.end==='a'?'b':'a']){$('log').textContent='양 끝점은 서로 다른 연결점을 선택하세요.';return;}w[wireEdit.end]=target;wireEdit=null;changed();return;}
 if(tool==='lead'){if(!pending){if(!/^(led|resistor):[ab]$/.test(id)){$('log').textContent='LED 또는 저항의 주황색/회색 다리를 먼저 선택하세요.';return;}pending=id;render();return;}if(!/^[A-J]\d+$/.test(id))return;const [part,terminal]=pending.split(':');s[part][terminal]=id;pending='';tool='';changed();return;}
 if(tool&&tool!=='wire'){place(resolve(id));return;}
 if(tool!=='wire'){selected=/^(led|resistor):/.test(id)?id.split(':')[0]:'';pending='';render();return;}
 if(pending){if(resolve(pending)===resolve(id)){pending='';render();return;}const a=resolve(pending),b=resolve(id);if(s.wires.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a))){$('log').textContent='이미 연결된 두 점이에요.';pending='';render();return;}s.wires.push({a,b,color:'#6366f1'});selected='wire:'+(s.wires.length-1);pending='';changed();}else{selected='';pending=id;render();}
};

let suppressClick=false,buttonDown=false;
svg.addEventListener('click',e=>{if(suppressClick){e.stopImmediatePropagation();suppressClick=false;}},true);
svg.onpointerdown=e=>{if(timer){if(e.target.closest('[data-press], [data-part="button"]')){buttonDown=true;svg.setPointerCapture(e.pointerId);render();}return;}
 if(['amp','speaker','button','led','resistor'].includes(tool)||tool==='wire'||wireEdit)return;
 const node=e.target.dataset.node,terminal=/^(led|resistor):([ab])$/.exec(node||''),part=terminal?.[1]||e.target.closest('[data-part]')?.dataset.part;
 if(part){selected=part;pending='';drag={part,terminal:terminal?.[2],start:position(e),original:{...s[part]}};}
 else if(e.target===svg)drag={part:'pan',start:position(e)};
 if(drag)svg.setPointerCapture(e.pointerId);
};
svg.onpointermove=e=>{
 if(!drag)return;
 const p=position(e);
 if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)<4&&!drag.moved)return;
 drag.moved=true;
 if(drag.part==='pan'){pan.x+=(p.x-drag.start.x)*zoom;pan.y+=(p.y-drag.start.y)*zoom;}
 else if(['amp','speaker','button'].includes(drag.part)){Object.assign(s[drag.part],snapModule(drag.original.x+p.x-drag.start.x,drag.original.y+p.y-drag.start.y));}
 else if(drag.terminal){const target=nearest(p.x,p.y),other=drag.terminal==='a'?'b':'a';if(target!==s[drag.part][other])s[drag.part][drag.terminal]=target;}
 else {
 const original=drag.original,[ax,ay]=xy(original.a),target=nearest(ax+p.x-drag.start.x,ay+p.y-drag.start.y);
 const columns='ABCDEFGHIJ',rowDelta=Number(target.slice(1))-Number(original.a.slice(1)),colDelta=columns.indexOf(target[0])-columns.indexOf(original.a[0]);
 const newRow=Number(original.b.slice(1))+rowDelta,newCol=columns.indexOf(original.b[0])+colDelta;
 if(newRow>=1&&newRow<=30&&newCol>=0&&newCol<10){s[drag.part].a=target;s[drag.part].b=columns[newCol]+newRow;}
 }
 render();
};
svg.onpointerup=()=>{if(buttonDown){buttonDown=false;render();}if(drag?.moved){suppressClick=true;changed();}drag=null;};
svg.onpointercancel=()=>{buttonDown=false;if(drag?.original)s[drag.part]=drag.original;drag=null;render();};
svg.ondragover=e=>e.preventDefault();
svg.ondrop=e=>{e.preventDefault();const p=position(e),id=nearest(p.x,p.y);if(['amp','speaker','button'].includes(tool)){s[tool]=snapModule(p.x,p.y);selected=tool;tool='';changed();return;}if(tool==='resistor'){const row=Number(id.slice(1)),end=row<=27?row+3:row-3;s.resistor={a:id,b:id[0]+end,ohms:220};tool='';pending='';selected='resistor';changed();}else place(id);};

function deleteSelected(){if(selected.startsWith('wire:'))s.wires.splice(Number(selected.slice(5)),1);else if(['amp','speaker','button','led','resistor'].includes(selected))s[selected]=null;selected='';pending='';wireEdit=null;changed();}
$('minus').onclick=()=>{zoom=Math.max(.5,zoom-.15);render();};$('plus').onclick=()=>{zoom=Math.min(2.5,zoom+.15);render();};$('home').onclick=()=>{zoom=1;pan={x:0,y:0};render();};
function highlight(){const code=esc($('code').value);$('highlight').innerHTML=code.replace(/\b(void|setup|loop|pinMode|digitalWrite|delay|OUTPUT|HIGH|LOW|int|const)\b/g,'<span class="kw">$1</span>').replace(/\b(\d+)\b/g,'<span class="num">$1</span>');}
$('code').value=s.code;$('code').oninput=()=>{s.code=$('code').value;highlight();save();};$('code').onscroll=()=>{$('highlight').scrollTop=$('code').scrollTop;$('highlight').scrollLeft=$('code').scrollLeft;};
function stop(){clearInterval(timer);timer=null;runtime=null;lit=false;buttonDown=false;setRunning(false);$('run').classList.remove('running');$('run').setAttribute('aria-pressed','false');render();}$('stop').onclick=()=>{stop();$('log').textContent='시뮬레이션 정지';};let audioContext=null,audioNodes=[],soundTimer=null;
const stopLed=stop;
stop=function(){stopLed();clearInterval(soundTimer);soundTimer=null;audioNodes.forEach(n=>{try{n.stop();}catch{}});audioNodes=[];if(audioContext){audioContext.close();audioContext=null;}};
$('stop').onclick=()=>{stop();$('log').textContent='시뮬레이션 정지';};
$('run').onclick=async()=>{
 stop();try{
 const normalize=code=>code.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'');
 if(normalize(s.code)===normalize(buttonCode)){
 $('run').classList.add('running');$('run').setAttribute('aria-pressed','true');
 timer=setInterval(()=>{const status=buttonStatus(s),connected=status.ok,circuit=validate(s),on=Boolean(buttonDown&&connected&&circuit.ok);if(lit!==on){lit=on;render();}$('pressState').textContent=(buttonDown?'버튼 눌림':'버튼 놓임')+' · LED '+(on?'ON':'OFF');$('log').textContent=`GPIO4: ${buttonDown&&connected?'LOW':'HIGH'} · LED: ${on?'ON':'OFF'}\n${!connected?status.message:!circuit.ok?circuit.message:'버튼을 누르고 있으면 LED가 켜집니다.'}`;},25);tool='';pending='';wireEdit=null;setRunning(true);render();return;
 }
 const tones=compileTones(s.code,firmwareTemplate),wiring=soundWiring(s);if(!wiring.ok)throw Error(wiring.message);
 audioContext=new AudioContext();await audioContext.resume();let time=audioContext.currentTime+.05;
 for(const tone of tones){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.value=tone.frequency;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.08,time+.005);gain.gain.setValueAtTime(.08,time+tone.duration/1000-.005);gain.gain.linearRampToValueAtTime(0,time+tone.duration/1000);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(time);oscillator.stop(time+tone.duration/1000);audioNodes.push(oscillator);time+=tone.duration/1000;}
 $('run').classList.add('running');$('run').setAttribute('aria-pressed','true');$('log').textContent='음계 재생 중 · '+tones.map(t=>t.frequency+'Hz').join(' → ');
 setRunning(true);const end=time;soundTimer=setInterval(()=>{if(!soundWiring(s).ok){stop();$('log').textContent='배선이 끊어져 재생을 정지했어요.';}else if(audioContext&&audioContext.currentTime>=end){stop();$('log').textContent='음계 재생 완료 · setup()은 한 번 실행됩니다.';}},40);
 }catch(err){stop();$('log').textContent=err.message;}
};
$('reset').onclick=()=>{if(!confirm('회로와 코드를 초기화할까요?'))return;stop();s=initial();$('code').value=s.code;pending='';selected='';tool='';wireEdit=null;highlight();changed();$('log').textContent='초기화 완료 · 부품을 배치하고 실행하세요.';};
highlight();render();
// Restore the authenticated student's work across sessions and devices.
if(false){
 const revision=JSON.stringify(s);
 fetch('/api/circuit-progress',{headers:{Authorization:'Bearer '+session}}).then(r=>r.ok?r.json():null).then(data=>{if(data?.progress?.data?.version===1&&JSON.stringify(s)===revision){s={...initial(),...data.progress.data,breadboard:true,board:{row:22},usb:true,split:false};$('code').value=s.code;highlight();render();$('saved').textContent='저장된 학습 결과 불러옴';}}).catch(()=>{});

}

function cancelWire(){pending='';wireEdit=null;tool='';render();}
$('cancelWire').onclick=cancelWire;

for(const [id,end] of [['moveStart','a'],['moveEnd','b']])$(id).onclick=()=>{if(!selected.startsWith('wire:'))return;wireEdit={index:Number(selected.slice(5)),end};pending='';tool='';render();};
$('deleteWire').onclick=deleteSelected;

document.addEventListener('keydown',e=>{if(['TEXTAREA','INPUT'].includes(e.target.tagName))return;if(e.key==='Escape')cancelWire();if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();deleteSelected();}});

$('wireList').onclick=e=>{const b=e.target.closest('[data-select-wire]');if(!b)return;selected='wire:'+b.dataset.selectWire;pending='';wireEdit=null;tool='';render();};
function renderSoundParts(){
 let h='<g><circle data-node="pin:44" cx="855" cy="170" r="7" fill="#d7b76c"/><text x="795" y="154" font-size="10" fill="#506078">GPIO44 · I2S 단자</text></g>';
 for(const part of ['amp','speaker','button']){
  const p=s[part];if(!p)continue;const {x,y}=p;
  h+=`<g data-part="${part}" filter="url(#componentShadow)">`;
  if(part==='amp')h+=`<rect x="${x-43}" y="${y-43}" width="86" height="92" rx="7" fill="#246b9b" stroke="#17496e" stroke-width="2"/><rect x="${x-9}" y="${y-14}" width="23" height="26" fill="#253040"/><path d="M${x-15} ${y-18}h38M${x-15} ${y+16}h38" stroke="#c9ced6" stroke-width="3" stroke-dasharray="2 3"/><text x="${x-28}" y="${y-30}" font-size="9" fill="white">MAX98357A</text>`;
  if(part==='speaker')h+=`<circle cx="${x}" cy="${y}" r="34" fill="#292e35" stroke="#151a21" stroke-width="3"/><circle cx="${x}" cy="${y}" r="27" fill="#555b63" stroke="#171e27" stroke-width="3"/><circle cx="${x}" cy="${y}" r="16" fill="#353b43"/><circle cx="${x}" cy="${y}" r="10" fill="url(#plastic)"/>`;
  if(part==='button')h+=`<rect x="${x-23}" y="${y-22}" width="46" height="42" rx="4" fill="url(#metal)" stroke="#647080"/><circle cx="${x}" cy="${y-(buttonDown?1:3)}" r="${buttonDown?12:14}" fill="${buttonDown?'#168571':'url(#plastic)'}" stroke="${buttonDown?'#60d9b4':'#212c3b'}" stroke-width="2"/><text x="${x-18}" y="${y-29}" font-size="10" fill="#54647b">버튼</text>`;
  h+='</g>';
  const pins=part==='amp'?['VDD','GND','BCLK','LRC','DIN','OUTP','OUTN']:part==='speaker'?['plus','minus']:['a','b'];
  for(const pin of pins){const id=part+':'+pin,[u,v]=xy(id);h+=`<circle data-node="${id}" cx="${u}" cy="${v}" r="5" fill="#d6b566" stroke="#725e32"/><text x="${u+(part==='amp'&&pin.startsWith('OUT')?-28:8)}" y="${v+3}" font-size="8" fill="${part==='amp'?'white':'#576378'}">${pin==='plus'?'+':pin==='minus'?'−':pin==='OUTP'?'OUT+':pin==='OUTN'?'OUT−':pin}</text>`;}
 }
 return h;
}

function setRunning(running){
 $('simulationState').textContent=running?'● 실행 중':'● 정지됨';
 $('simulationState').dataset.running=String(running);
 $('run').disabled=running;$('run').innerHTML=running?'▶ 실행 중':'▶ 실행';
 $('stop').disabled=!running;$('pressPanel').hidden=!(running&&timer);
 $('pressButton').disabled=!s.button;
}
$('stop').disabled=true;
const pressControl=$('pressButton');
pressControl.onpointerdown=e=>{if(!timer||!s.button)return;e.preventDefault();buttonDown=true;pressControl.setPointerCapture(e.pointerId);render();};
pressControl.onpointerup=pressControl.onpointercancel=()=>{buttonDown=false;render();};
pressControl.onkeydown=e=>{if((e.key===' '||e.key==='Enter')&&timer){e.preventDefault();buttonDown=true;render();}};
pressControl.onkeyup=e=>{if(e.key===' '||e.key==='Enter'){buttonDown=false;render();}};
window.addEventListener('blur',()=>{buttonDown=false;render();});
