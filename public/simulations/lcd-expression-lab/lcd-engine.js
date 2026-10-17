import {group,topPins,bottomPins} from './engine.js';
export const lcdConnections=[['VCC','P15','VCC → 상단 + 레일'],['GND','N15','GND → 상단 − 레일'],['DIN','pin:11','DIN → GPIO11'],['CLK','pin:12','CLK → GPIO12'],['CS','pin:13','CS → GPIO13'],['DC','pin:7','DC → GPIO7'],['RST','pin:6','RST → GPIO6'],['BL','P16','BL → 상단 + 레일']];
export function lcdWiring(s){
 if(!s.lcd)return {ok:false,message:'LCD를 배치하세요.'};
 const parent=new Map();const root=id=>{id=group(id,s.split);if(!parent.has(id))parent.set(id,id);while(parent.get(id)!==id)id=parent.get(id);return id;};const join=(a,b)=>parent.set(root(a),root(b));
 s.wires.forEach(w=>join(w.a,w.b));topPins.forEach((p,i)=>join('pin:'+p,'E'+(s.board.row+i)));bottomPins.forEach((p,i)=>join('pin:'+p,'F'+(s.board.row+i)));
 if(root('pin:5V')===root('pin:GND'))return {ok:false,message:'단락 위험: + 레일과 − 레일을 분리하세요.'};
 const expected={VCC:'pin:5V',GND:'pin:GND',DIN:'pin:11',CLK:'pin:12',CS:'pin:13',DC:'pin:7',RST:'pin:6',BL:'pin:5V'};
 for(const [pin,target] of Object.entries(expected))if(root('lcd:'+pin)!==root(target))return {ok:false,message:'연결 확인: LCD '+pin+' → '+(pin==='GND'?'상단 − 레일':['VCC','BL'].includes(pin)?'상단 + 레일':target.replace('pin:','GPIO'))};
 return {ok:true,message:'LCD 배선 정상'};
}
const colors={BLACK:'#080e15',WHITE:'#fff',RED:'#ef4444',GREEN:'#22c55e',BLUE:'#3b82f6',YELLOW:'#facc15',CYAN:'#22d3ee',MAGENTA:'#e879f9'};
export function compileDisplay(source,template){
 const clean=s=>s.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'');
 const dynamic=/tft\.(?:print\("[^"\n]*"\)|setTextColor\(ST77XX_[A-Z]+\)|fillScreen\(ST77XX_[A-Z]+\)|setTextSize\(\d+\)|setCursor\(\s*\d+\s*,\s*\d+\s*\))\s*;/g;
 if(clean(source.replace(dynamic,''))!==clean(template.replace(dynamic,'')))throw Error('기본 LCD 코드의 print, setTextColor, fillScreen, setTextSize, setCursor 편집을 지원해요. 다른 문법은 Arduino IDE에서 실행하세요.');
 const text=/tft\.print\("([^"\n]*)"\)/.exec(source)?.[1],fg=/tft\.setTextColor\(ST77XX_([A-Z]+)\)/.exec(source)?.[1],bg=/tft\.fillScreen\(ST77XX_([A-Z]+)\)/.exec(source)?.[1],size=Number(/tft\.setTextSize\((\d+)\)/.exec(source)?.[1]);const cursor=/tft\.setCursor\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(source);
 if(text===undefined||!colors[fg]||!colors[bg]||size<1||size>8||!cursor)throw Error('출력 문구, ST77XX 색상, 글자 크기(1~8), 좌표를 확인하세요.');
 return {text,fg:colors[fg],bg:colors[bg],size,x:Number(cursor[1]),y:Number(cursor[2])};
}

function parseScreenBody(body){
 const commands=[];
 for(const stmt of body.split(';').map(s=>s.trim()).filter(Boolean)){
  if(stmt==='pressCount++'){commands.push({op:'increment'});continue;}
  const bg=/^uint16_t\s+bg\s*=\s*\(pressCount\s*%\s*2\)\s*\?\s*ST77XX_(\w+)\s*:\s*ST77XX_(\w+)$/.exec(stmt);
  if(bg){if(!colors[bg[1]]||!colors[bg[2]])throw Error('지원하지 않는 LCD 색상');commands.push({op:'background',odd:colors[bg[1]],even:colors[bg[2]]});continue;}
  const call=/^tft\.(fillScreen|setTextColor|setTextSize|setCursor|print)\s*\(([\s\S]*)\)$/.exec(stmt);
  if(!call)throw Error('지원하지 않는 화면 명령: '+stmt);
  const [,op,arg]=call;
  if(op==='fillScreen'&&arg.trim()==='bg'){commands.push({op:'fillVariable'});continue;}
  if(op==='fillScreen'||op==='setTextColor'){const name=/^ST77XX_(\w+)$/.exec(arg.trim())?.[1];if(!colors[name])throw Error('지원하지 않는 LCD 색상');commands.push({op,value:colors[name]});}
  else if(op==='setTextSize'){const size=Number(arg);if(!Number.isInteger(size)||size<1||size>8)throw Error('글자 크기는 1~8');commands.push({op,value:size});}
  else if(op==='setCursor'){const m=/^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(arg);if(!m)throw Error('좌표는 정수 두 개');commands.push({op,x:Number(m[1]),y:Number(m[2])});}
  else {const m=/^"([^"\n]*)"$/.exec(arg.trim());if(!m&&arg.trim()!=='pressCount')throw Error('print는 문자열 또는 pressCount를 지원합니다.');commands.push({op,value:m?.[1],counter:!m});}
 }
 return commands;
}
export function compileCounter(source,template){
 const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const bodies={},pattern=/void\s+(drawTestScreen|showPress)\s*\(\s*\)\s*\{([^{}]*)\}/g;
 const code=strip(source),baseline=strip(template);
 const skeleton=code.replace(pattern,(_,name,body)=>{bodies[name]=body;return 'void '+name+'(){}';});
 if(skeleton.replace(/\s+/g,'')!==baseline.replace(pattern,(_,name)=>'void '+name+'(){}').replace(/\s+/g,''))throw Error('3-6 코드의 화면 출력 함수 편집을 지원합니다. 그 외 C++ 변경은 아직 지원하지 않습니다.');
 if(!bodies.drawTestScreen||!bodies.showPress)throw Error('drawTestScreen / showPress 함수를 확인하세요.');
 const start=parseScreenBody(bodies.drawTestScreen),press=parseScreenBody(bodies.showPress);
 function screen(commands,count,previous){let fg=previous?.fg||colors.WHITE,size=1,x=0,y=0,bg=previous?.bg||colors.BLACK,variable=bg,lines=[];
  for(const c of commands){if(c.op==='background')variable=count%2?c.odd:c.even;if(c.op==='fillVariable'){bg=variable;lines=[];}if(c.op==='fillScreen'){bg=c.value;lines=[];}if(c.op==='setTextColor')fg=c.value;if(c.op==='setTextSize')size=c.value;if(c.op==='setCursor'){x=c.x;y=c.y;}if(c.op==='print'){const text=c.counter?String(count):c.value;lines.push({text,x,y,size,fg});x+=text.length*6*size;}}
  return {lines,bg,fg,text:lines.map(l=>l.text).join('')};
 }
 return {kind:'counter',initial:()=>screen(start,0),press:(count,previous)=>screen(press,count,previous),tones:[{frequency:523.25,duration:180},{frequency:659.25,duration:180},{frequency:783.99,duration:300}]};
}
