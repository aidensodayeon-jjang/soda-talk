const colors={BLACK:'#080e15',WHITE:'#fff',RED:'#ef4444',GREEN:'#22c55e',BLUE:'#3b82f6',YELLOW:'#facc15',CYAN:'#22d3ee',MAGENTA:'#e879f9'};
export function compileShapes(source,template){
 const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const pattern=/tft\.(fillScreen|drawLine|drawRect|fillRect|drawCircle|fillCircle)\s*\(([^()]*)\)\s*;|delay\s*\(\s*(\d+)\s*\)\s*;/g;
 const clean=strip(source),baseline=strip(template);
 if(clean.replace(pattern,'').replace(/\s+/g,'')!==baseline.replace(pattern,'').replace(/\s+/g,''))throw Error('도형·색상·좌표·delay 편집을 지원합니다. 그 외 C++ 문법은 지원하지 않습니다.');
 const events=[];let time=0;
 for(const m of clean.matchAll(pattern)){
  if(m[3]!==undefined){const duration=Number(m[3]);if(duration>60000)throw Error('delay는 0~60000ms');time+=duration;continue;}
  const type=m[1],args=m[2].split(',').map(s=>s.trim()),color=colors[args.pop()?.replace('ST77XX_','')];if(!color)throw Error('ST77XX 색상을 확인하세요.');
  const numbers=args.map(Number),length=type==='fillScreen'?0:['drawCircle','fillCircle'].includes(type)?3:4;
  if(numbers.length!==length||numbers.some((v,i)=>!/^[-]?\d+$/.test(args[i])||!Number.isSafeInteger(v)||Math.abs(v)>4096))throw Error(type+'의 정수 인수를 확인하세요.');
  if(['drawCircle','fillCircle'].includes(type)&&numbers[2]<0)throw Error('반지름은 0 이상');
  if(['drawRect','fillRect'].includes(type)&&(numbers[2]<0||numbers[3]<0))throw Error('너비와 높이는 0 이상');
  events.push({at:time,type,args:numbers,color});
 }
 if(!events.length||events.length>500)throw Error('도형 명령은 1~500개');
 return {duration:time,frame(elapsed){let bg=colors.BLACK,shapes=[],stage=0;for(const e of events){if(e.at>elapsed)break;stage++;if(e.type==='fillScreen'){bg=e.color;shapes=[];}else shapes.push(e);}return {bg,shapes,lines:[],stage,text:'도형 '+shapes.length+'개'};}};
}
export function shapeSvg(shape){const {type,args:a,color}=shape;
 if(type==='drawLine')return `<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" stroke="${color}" stroke-width="1"/>`;
 if(type==='drawRect'||type==='fillRect')return `<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" fill="${type==='fillRect'?color:'none'}" stroke="${color}" stroke-width="1"/>`;
 return `<circle cx="${a[0]}" cy="${a[1]}" r="${a[2]}" fill="${type==='fillCircle'?color:'none'}" stroke="${color}" stroke-width="1"/>`;
}
