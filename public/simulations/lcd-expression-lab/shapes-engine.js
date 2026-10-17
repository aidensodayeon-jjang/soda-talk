const colors={BLACK:'#080e15',WHITE:'#fff',RED:'#ef4444',GREEN:'#22c55e',BLUE:'#3b82f6',YELLOW:'#facc15',CYAN:'#22d3ee',MAGENTA:'#e879f9'};
export function compileShapes(source,template){
 const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const pattern=/tft\.(fillScreen|drawLine|drawRect|fillRect|drawCircle|fillCircle|setTextColor|setTextSize|setCursor|print)\s*\(([^()]*)\)\s*;|delay\s*\(\s*(\d+)\s*\)\s*;/g;
 const clean=strip(source),baseline=strip(template);
 if(clean.replace(pattern,'').replace(/\s+/g,'')!==baseline.replace(pattern,'').replace(/\s+/g,''))throw Error('도형·색상·좌표·delay 편집을 지원합니다. 그 외 C++ 문법은 지원하지 않습니다.');
 const events=[];let time=0;
 for(const m of clean.matchAll(pattern)){
  if(m[3]!==undefined){const duration=Number(m[3]);if(duration>60000)throw Error('delay는 0~60000ms');time+=duration;continue;}
  const type=m[1];
  if(type==='print'){let text;try{text=JSON.parse(m[2].trim());}catch{throw Error('문구는 큰따옴표로 감싸세요.');}if(typeof text!=='string'||text.length>100)throw Error('문구는 100자 이내');events.push({at:time,type,text});continue;}
  const args=m[2].split(',').map(s=>s.trim());
  if(type==='setTextColor'){const color=colors[args[0]?.replace('ST77XX_','')];if(args.length!==1||!color)throw Error('글자 색상을 확인하세요.');events.push({at:time,type,color});continue;}
  if(type==='setTextSize'||type==='setCursor'){const numbers=args.map(Number);if(numbers.length!==(type==='setCursor'?2:1)||numbers.some((v,i)=>!/^\d+$/.test(args[i])||v>4096)||type==='setTextSize'&&(numbers[0]<1||numbers[0]>8))throw Error('글자 크기 또는 좌표를 확인하세요.');events.push({at:time,type,args:numbers});continue;}
  const color=colors[args.pop()?.replace('ST77XX_','')];if(!color)throw Error('ST77XX 색상을 확인하세요.');
  const numbers=args.map(Number),length=type==='fillScreen'?0:['drawCircle','fillCircle'].includes(type)?3:4;
  if(numbers.length!==length||numbers.some((v,i)=>!/^[-]?\d+$/.test(args[i])||!Number.isSafeInteger(v)||Math.abs(v)>4096))throw Error(type+'의 정수 인수를 확인하세요.');
  if(['drawCircle','fillCircle'].includes(type)&&numbers[2]<0)throw Error('반지름은 0 이상');
  if(['drawRect','fillRect'].includes(type)&&(numbers[2]<0||numbers[3]<0))throw Error('너비와 높이는 0 이상');
  events.push({at:time,type,args:numbers,color});
 }
 if(!events.length||events.length>500)throw Error('도형 명령은 1~500개');
 return {duration:time,frame(elapsed){let bg=colors.BLACK,shapes=[],stage=0,fg=colors.WHITE,size=1,x=0,y=0;for(const e of events){if(e.at>elapsed)break;stage++;if(e.type==='fillScreen'){bg=e.color;shapes=[];}else if(e.type==='setTextColor')fg=e.color;else if(e.type==='setTextSize')size=e.args[0];else if(e.type==='setCursor'){x=e.args[0];y=e.args[1];}else if(e.type==='print'){shapes.push({type:'text',text:e.text,x,y,size,color:fg});x+=e.text.length*6*size;}else shapes.push(e);}return {bg,shapes,lines:[],stage,text:'액자 출력'};}};
}
export function shapeSvg(shape){const {type,args:a,color}=shape;
 if(type==='text'){const safe=shape.text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return `<text x="${shape.x}" y="${shape.y+shape.size*7}" font-family="monospace" font-size="${shape.size*8}" fill="${color}">${safe}</text>`;}
 if(type==='drawLine')return `<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" stroke="${color}" stroke-width="1"/>`;
 if(type==='drawRect'||type==='fillRect')return `<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" fill="${type==='fillRect'?color:'none'}" stroke="${color}" stroke-width="1"/>`;
 return `<circle cx="${a[0]}" cy="${a[1]}" r="${a[2]}" fill="${type==='fillCircle'?color:'none'}" stroke="${color}" stroke-width="1"/>`;
}
