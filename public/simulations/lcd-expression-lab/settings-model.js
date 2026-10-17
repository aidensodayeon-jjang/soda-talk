const functions={idle:'drawIdle',happy:'drawHappy',surprised:'drawSurprised'};
const palette=['BLACK','WHITE','RED','GREEN','BLUE','YELLOW','CYAN','MAGENTA'];
export function faceCode({target,eyes,mouth,radius,foreground,background}){
 if(!functions[target]||!['round','happy','square'].includes(eyes)||!['smile','line','open'].includes(mouth)||!palette.includes(foreground)||!palette.includes(background)||!Number.isInteger(radius)||radius<6||radius>25)throw Error('표정 설정 범위를 확인하세요.');
 const color='ST77XX_'+foreground,lines=['  tft.fillScreen(ST77XX_'+background+');'];
 for(const x of [110,210]){if(eyes==='round')lines.push(`  tft.fillCircle(${x}, 85, ${radius}, ${color});`);else if(eyes==='square')lines.push(`  tft.fillRect(${x-radius}, ${85-radius}, ${radius*2}, ${radius*2}, ${color});`);else{lines.push(`  tft.drawLine(${x-radius}, 90, ${x}, ${90-radius}, ${color});`);lines.push(`  tft.drawLine(${x}, ${90-radius}, ${x+radius}, 90, ${color});`);}}
 if(mouth==='line')lines.push(`  tft.drawLine(125, 160, 195, 160, ${color});`);
 else if(mouth==='open')lines.push(`  tft.drawCircle(160, 160, 25, ${color});`);
 else lines.push(`  tft.drawLine(115, 145, 140, 170, ${color});`,`  tft.drawLine(140, 170, 180, 170, ${color});`,`  tft.drawLine(180, 170, 205, 145, ${color});`);
 return {name:functions[target],body:lines.join('\n')};
}
export function replaceFunction(source,name,body){
 if(!['drawIdle','drawHappy','drawSurprised','playFeedback'].includes(name))throw Error('지원하지 않는 수정 영역');
 const pattern=new RegExp('void\\s+'+name+'\\s*\\(\\s*\\)\\s*\\{[^{}]*\\}');
 if(!pattern.test(source))throw Error(name+' 함수를 찾을 수 없어요. 함수 이름을 유지하세요.');
 return source.replace(pattern,()=>`void ${name}() {\n${body}\n}`);
}
export function soundCode(notes){
 if(notes.length!==3||notes.some(n=>!Number.isFinite(n.frequency)||n.frequency<20||n.frequency>20000||!Number.isInteger(n.duration)||n.duration<10||n.duration>5000))throw Error('주파수는 20~20000Hz, 길이는 10~5000ms로 입력하세요.');
 return notes.map(n=>`  playTone(${n.frequency}, ${n.duration});`).join('\n');
}
export function replaceLed(source,hold){
 if(!Number.isInteger(hold)||hold<0||hold>10000)throw Error('LED 시간은 0~10000ms');
 if(!/#define\s+LED_ON_TIME\s+\d+/.test(source))throw Error('LED_ON_TIME을 찾을 수 없어요.');
 return source.replace(/(#define\s+LED_ON_TIME\s+)\d+/,(_,prefix)=>prefix+hold);
}
export {palette};
export function readFunctionBody(source,name){return new RegExp('void\\s+'+name+'\\s*\\(\\s*\\)\\s*\\{([^{}]*)\\}').exec(source)?.[1]||'';}
