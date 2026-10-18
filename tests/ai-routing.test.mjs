import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transform} from 'esbuild';
const {code}=await transform(readFileSync('src/utils/aiRouting.ts','utf8'),{loader:'ts',format:'esm'});
const {reserveGptRoute,koreaDay,withProviderFallback}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const settings={aiProvider:'local',hybridModeEnabled:true,dailyGptQuota:30};
test('each account gets 30 GPT requests then LM',()=>{const a={},b={};for(let i=0;i<30;i++)assert.equal(reserveGptRoute(a,settings),true);assert.equal(reserveGptRoute(a,settings),false);assert.equal(reserveGptRoute(b,settings),true);assert.equal(a.gptUsageCount,30)});
test('Korean midnight resets daily allocation',()=>{const u={};assert.equal(koreaDay(new Date('2026-10-18T15:00:00Z')),'2026-10-19');for(let i=0;i<30;i++)reserveGptRoute(u,settings,new Date('2026-10-18T14:59:59Z'));assert.equal(reserveGptRoute(u,settings,new Date('2026-10-18T15:00:00Z')),true);assert.equal(u.gptUsageCount,1)});
test('both failure directions switch once',async()=>{for(const primary of [true,false]){const calls=[];const result=await withProviderFallback(primary,async gpt=>{calls.push(gpt);if(calls.length===1)throw Error('offline');return gpt});assert.deepEqual(calls,[primary,!primary]);assert.equal(result,!primary)}});
test('both providers failing surfaces failure without retry loop',async()=>{let n=0;await assert.rejects(withProviderFallback(true,async()=>{n++;throw Error('offline')}));assert.equal(n,2)});
test('zero quota and successful primary do not call fallback',async()=>{assert.equal(reserveGptRoute({},{...settings,dailyGptQuota:0}),false);let n=0;await withProviderFallback(false,async()=>++n);assert.equal(n,1)});
