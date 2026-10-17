import {test} from 'node:test';
import assert from 'node:assert/strict';
import {micConnections,micWiring,simulatedLevel} from '../public/simulations/mic-lab/mic-engine.js';
const completed=()=>({mic:{x:481,y:305},board:{row:22},split:true,wires:[
 {a:'pin:5V',b:'P30'},{a:'pin:GND',b:'N29'},{a:'N15',b:'N16'},
 ...micConnections.map(([a,b])=>({a,b})),
]});
test('complete microphone circuit with split 3.3V and 5V rails passes',()=>assert.equal(micWiring(completed()).ok,true));
test('missing rail feed and floating channel select are detected',()=>{
 for(const target of ['pin:3V3','mic:L/R']){
  const s=completed();s.wires=s.wires.filter(w=>w.a!==target);
  assert.equal(micWiring(s).ok,false);
 }
});
test('5V power and bridging the two positive rails are blocked',()=>{
 const s=completed();s.wires.push({a:'P15',b:'P16'});
 assert.equal(micWiring(s).danger,true);
 const other=completed();other.wires=other.wires.map(w=>w.a==='mic:VDD'?{...w,b:'P20'}:w);
 assert.equal(micWiring(other).danger,true);
});
test('signal swapped, shorted, or grounded fails',()=>{
 const swapped=completed();swapped.wires=swapped.wires.map(w=>w.a==='mic:SCK'?{...w,b:'pin:10'}:w);
 assert.equal(micWiring(swapped).ok,false);
 const short=completed();short.wires.push({a:'mic:SD',b:'mic:WS'});
 assert.equal(micWiring(short).danger,true);
});
test('equivalent breadboard hole connections work',()=>{
 const s=completed();s.wires=s.wires.map(w=>w.b==='pin:9'?{...w,b:'J23'}:w);
 assert.equal(micWiring(s).ok,true);
});
test('virtual input is silent when released and follows slider while pressed',()=>{
 assert.equal(simulatedLevel(100,false,100),0);
 assert.equal(simulatedLevel(0,true,100),0);
 assert.ok(simulatedLevel(90,true,100)>simulatedLevel(20,true,100));
 assert.ok(simulatedLevel(1000,true,100)<=100);
});
