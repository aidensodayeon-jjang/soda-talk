import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transform} from 'esbuild';
const {code}=await transform(readFileSync('src/utils/aiSkillUtils.ts','utf8'),{loader:'ts',format:'esm'});
const {generateInitialReport,DEFAULT_AI_SKILL_TEMPLATES,compileAiSkillPrompt,sanitizeLegacySkillReport,normalizeSkillSlots,customSlotLabel}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const skill=DEFAULT_AI_SKILL_TEMPLATES[1];
const log=(version,q,response,id=skill.id)=>({id:response,skillId:id,version,userQuestion:q,aiResponse:response,timestamp:new Date().toISOString()});
test('empty report does not claim measured success or invent test answers',()=>{const r=generateInitialReport('학생','봇',skill,[]);assert.deepEqual(r.actualLogs,[]);assert.match(r.goodPoints,/아직/);assert.match(r.comparisonV1V2.v1Response,/없습니다/);assert.doesNotMatch(JSON.stringify(r),/대폭 향상|만족스러웠/)});
test('reports separate skills and only compare identical questions',()=>{const r=generateInitialReport('학생','봇',skill,[log(1,'Q','before'),log(2,'other','wrong-pair'),log(2,'Q','after'),log(1,'Q','foreign','other-skill')]);assert.equal(r.actualLogs.length,3);assert.equal(r.comparisonV1V2.v1Response,'before');assert.equal(r.comparisonV1V2.v2Response,'after')});
test('unmatched new versions are not presented as a controlled comparison',()=>{const r=generateInitialReport('학생','봇',skill,[log(1,'Q1','before'),log(2,'Q2','after')]);assert.match(r.comparisonV1V2.v2Response,/같은 질문/)});
test('coding prompt actually changes when hint setting is changed',()=>{const before=compileAiSkillPrompt({...skill,type:'coding',codingOptions:{codeGenMode:'hint'}});const after=compileAiSkillPrompt({...skill,type:'coding',codingOptions:{codeGenMode:'full'}});assert.notEqual(before,after);assert.match(before,/힌트/)});

test('legacy automatic praise is removed while student-written observations stay',()=>{
 const r=generateInitialReport('학생','봇',skill,[]);r.goodPoints='질문의 의도를 잘 파악하고 친근한 어조로 즉시 답변을 제공하여 만족스러웠습니다.';r.painPoints='내가 기록한 문제';
 const cleaned=sanitizeLegacySkillReport(r);assert.match(cleaned.goodPoints,/아직/);assert.equal(cleaned.painPoints,'내가 기록한 문제');assert.notEqual(cleaned.goodPoints,r.goodPoints);
});

test('six choices include three independent custom slots and no removed presets',()=>{
 const skills=normalizeSkillSlots();assert.equal(skills.length,6);assert.equal(skills.filter(s=>s.type==='custom').length,3);assert.ok(!skills.some(s=>['daily','presentation'].includes(s.type)));
 skills.find(s=>s.id==='skill-custom-builder-2').customInputs.mustDo='둘째 슬롯 규칙';
 assert.notEqual(skills.find(s=>s.id==='skill-custom-builder').customInputs.mustDo,'둘째 슬롯 규칙');
 assert.equal(customSlotLabel('skill-custom-builder-3'),'직접 만들기 3');
});
test('existing custom work keeps its stable ID, name, rules, version',()=>{
 const old={...DEFAULT_AI_SKILL_TEMPLATES.find(s=>s.id==='skill-custom-builder'),name:'내가 만든 봇',version:4,customInputs:{skillName:'내 봇',mustDo:'내 규칙'}};
 const migrated=normalizeSkillSlots([old,{id:'skill-daily-friend',type:'daily'}]);
 assert.deepEqual(migrated.find(s=>s.id===old.id),old);assert.equal(migrated.length,6);
});
