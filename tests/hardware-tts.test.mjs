import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';
const {code}=await transform(readFileSync('src/utils/hardwareTts.ts','utf8'),{loader:'ts',format:'esm'});
const {fetchHardwareSpeech}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const signal=()=>new AbortController().signal;
test('mid-body terminated response is discarded, then a complete PCM response is returned',async()=>{
 let calls=0;
 const pcm=await fetchHardwareSpeech('test','hello',signal(),async()=>{
  calls++;if(calls===1)return {ok:true,arrayBuffer:async()=>{throw new TypeError('terminated')}};
  return new Response(new Uint8Array([1,2,3,4]));
 });assert.equal(calls,2);assert.deepEqual([...pcm],[1,2,3,4]);
});
test('transient upstream HTTP errors retry once',async()=>{
 let calls=0;await fetchHardwareSpeech('test','hello',signal(),async()=>++calls===1?new Response('',{status:503}):new Response(new Uint8Array([0,0])));assert.equal(calls,2);
});
test('authentication failure is not retried',async()=>{
 let calls=0;await assert.rejects(fetchHardwareSpeech('test','hello',signal(),async()=>{calls++;return new Response('',{status:401})}));assert.equal(calls,1);
});
test('repeated truncation fails after two attempts',async()=>{
 let calls=0;await assert.rejects(fetchHardwareSpeech('test','hello',signal(),async()=>{calls++;return new Response(new Uint8Array([0]))}));assert.equal(calls,2);
});
test('cancellation stops retry',async()=>{
 const c=new AbortController();let calls=0;
 await assert.rejects(fetchHardwareSpeech('test','hello',c.signal,async()=>{calls++;c.abort();throw new Error('cancelled')}));assert.equal(calls,1);
});
