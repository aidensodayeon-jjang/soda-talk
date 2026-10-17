import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';
const {code}=await transform(readFileSync('src/utils/friendSettings.ts','utf8'),{loader:'ts',format:'esm'});
const {normalizeFriendSettings,validateFriendSettings,friendToneInstruction,resolveFriendUser}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('single profile name overrides conflicting legacy nickname',()=>{
 const settings=normalizeFriendSettings({persona:{callSign:'예전호칭'},profile:{userName:'새이름'},memories:[]},'계정이름');
 assert.equal(settings.profile.userName,'새이름');assert.equal(settings.persona.callSign,'새이름');
});
test('legacy nickname is preserved if no profile name was entered',()=>{
 assert.equal(normalizeFriendSettings({persona:{callSign:'내별명'}},'계정').profile.userName,'내별명');
});
test('new defaults do not fabricate personal details or memories',()=>{
 const settings=normalizeFriendSettings({},'내계정');
 assert.equal(settings.profile.userName,'내계정');assert.equal(settings.profile.school,'');
 assert.equal(settings.profile.goal,'');assert.deepEqual(settings.profile.interests,[]);assert.deepEqual(settings.memories,[]);
});
test('deleted memories stay empty after save/load round trip',()=>{
 const before=normalizeFriendSettings({memories:[{content:'기억'}]});
 before.memories=[];
 assert.deepEqual(normalizeFriendSettings(JSON.parse(JSON.stringify(before))).memories,[]);
});
test('all three tones have distinct instructions; teacher stays polite',()=>{
 const tones=['존댓말','친근한 친구말','선생님 말투'].map(friendToneInstruction);
 assert.equal(new Set(tones).size,3);assert.match(tones[2],/선생님.*존댓말/);
});
test('invalid API key never selects unrelated account',()=>{
 const users=[{id:'admin',personalApiKey:'admin-key'},{id:'student',personalApiKey:'student-key'}];
 assert.equal(resolveFriendUser('',users),undefined);assert.equal(resolveFriendUser('wrong',users),undefined);
 assert.equal(resolveFriendUser('student-key',users)?.id,'student');
 assert.equal(resolveFriendUser('valid-session',users,'student')?.id,'student');
 assert.equal(resolveFriendUser('expired',users,'missing'),undefined);
});
test('server validation rejects malformed fields and excess memories',()=>{
 const settings=normalizeFriendSettings({},'계정');assert.equal(validateFriendSettings(settings),null);
 assert.ok(validateFriendSettings({...settings,memories:Array(4).fill({text:'기억'})}));
 assert.ok(validateFriendSettings({...settings,profile:{userName:42}}));
 assert.ok(validateFriendSettings({...settings,persona:[]}));
 assert.ok(validateFriendSettings({...settings,memories:[{text:{bad:true}}]}));
});
