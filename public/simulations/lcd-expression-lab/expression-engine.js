import {compileShapes} from './shapes-engine.js';
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
export function compileExpression(source,template){
 const bodies={};
 const funcs=/void\s+(drawIdle|drawHappy|drawSurprised|playFeedback)\s*\(\s*\)\s*\{([^{}]*)\}/g;
 const skeleton=code=>strip(code).replace(funcs,(_,name,body)=>{if(code===source)bodies[name]=body;return 'void '+name+'(){}';}).replace(/#define\s+LED_ON_TIME\s+\d+/g,'#define LED_ON_TIME 0').replace(/\s+/g,'');
 if(skeleton(source)!==skeleton(template))throw Error('표정 함수·playFeedback·LED_ON_TIME 영역을 수정하세요. 그 외 문법은 아직 지원하지 않습니다.');
 const screen=name=>{if(!bodies[name])throw Error(name+' 함수가 필요해요.');return compileShapes('void setup(){'+bodies[name]+'}void loop(){}','void setup(){}void loop(){}').frame(0);};
 const frames=[screen('drawIdle'),screen('drawHappy'),screen('drawSurprised')];
 const pattern=/playTone\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+)\s*\)\s*;/g;
 const tones=[...(bodies.playFeedback||'').matchAll(pattern)].map(m=>({frequency:Number(m[1]),duration:Number(m[2])}));
 if(!tones.length||tones.length>30||(bodies.playFeedback||'').replace(pattern,'').trim()||tones.some(n=>n.frequency<20||n.frequency>20000||n.duration<10||n.duration>5000))throw Error('소리 영역은 playTone(20~20000Hz, 10~5000ms)를 사용하세요.');
 const hold=Number(/#define\s+LED_ON_TIME\s+(\d+)/.exec(source)?.[1]);if(!Number.isInteger(hold)||hold<0||hold>10000)throw Error('LED_ON_TIME은 0~10000ms');
 return {kind:'expression',initial:()=>frames[0],press:count=>frames[count%2===1?1:2],tones,hold,duration:tones.reduce((sum,n)=>sum+n.duration,0)+hold};
}
