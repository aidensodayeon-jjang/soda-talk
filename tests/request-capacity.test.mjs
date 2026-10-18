import {test} from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {readFileSync} from 'node:fs';import {transform} from 'esbuild';
const {code}=await transform(readFileSync('src/utils/requestCapacity.ts','utf8'),{loader:'ts',format:'esm'});
const {createRequestCapacity}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const response=()=>Object.assign(new EventEmitter(),{setHeader(){},status(n){this.code=n;return this},json(b){this.body=b}});
const req=key=>({headers:{authorization:key}});
test('overflow waits and automatically runs in order',()=>{
 const gate=createRequestCapacity(1);const order=[];const a=response(),b=response(),c=response();
 gate(req('a'),a,()=>order.push('a'));gate(req('b'),b,()=>order.push('b'));gate(req('c'),c,()=>order.push('c'));
 assert.deepEqual(order,['a']);assert.equal(b.code,undefined);a.emit('finish');assert.deepEqual(order,['a','b']);b.emit('finish');assert.deepEqual(order,['a','b','c']);c.emit('finish');
});
test('same account stays sequential without blocking another account',()=>{
 const gate=createRequestCapacity(2);const order=[];const a=response(),a2=response(),b=response();
 gate(req('a'),a,()=>order.push('a'));gate(req('a'),a2,()=>order.push('a2'));gate(req('b'),b,()=>order.push('b'));
 assert.deepEqual(order,['a','b']);a.emit('finish');assert.deepEqual(order,['a','b','a2']);a2.emit('finish');b.emit('finish');
});
test('disconnected queued requests never run',()=>{
 const gate=createRequestCapacity(1);const a=response(),b=response();let ran=false;
 gate(req('a'),a,()=>{});gate(req('b'),b,()=>ran=true);b.emit('close');a.emit('close');assert.equal(ran,false);
});
test('bounded wait and queue capacity return explicit failure',async()=>{
 const gate=createRequestCapacity(1,undefined,{maxWaiting:1,maxWaitMs:20});const a=response(),b=response(),c=response();
 gate(req('a'),a,()=>{});gate(req('b'),b,()=>assert.fail('expired request ran'));gate(req('c'),c,()=>assert.fail('overflow ran'));assert.equal(c.code,503);
 await new Promise(r=>setTimeout(r,35));assert.equal(b.code,503);a.emit('finish');
});

test('default queue waits without an automatic deadline',async()=>{
 const gate=createRequestCapacity(1);const a=response(),b=response();let ran=false;
 gate(req('a'),a,()=>{});gate(req('b'),b,()=>ran=true);
 await new Promise(r=>setTimeout(r,30));assert.equal(b.code,undefined);assert.equal(ran,false);
 a.emit('finish');assert.equal(ran,true);b.emit('finish');
});
