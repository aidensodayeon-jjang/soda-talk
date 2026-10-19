import http from 'node:http';import {spawn} from 'node:child_process';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
const root=process.cwd(),temp=await mkdtemp(path.join(os.tmpdir(),'soda-skills-'));let child;let captured,offline=false;
const mock=http.createServer(async(req,res)=>{let raw='';for await(const b of req)raw+=b;captured=JSON.parse(raw);if(offline){res.writeHead(503);return res.end()}
 if(captured.stream){res.setHeader('Content-Type','text/event-stream');res.end('data: '+JSON.stringify({model:'mock',choices:[{delta:{content:'실제 경로 응답'}}]})+'\n\ndata: [DONE]\n\n')}
 else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({model:'mock',choices:[{message:{content:'실제 경로 응답'}}]}))}});
const base='http://127.0.0.1:17997';const api=(user,url,body)=>fetch(base+url,{method:body?'POST':'GET',headers:{Authorization:'Bearer skill-test-'+user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
try{
 await mkdir(path.join(temp,'data'));await writeFile(path.join(temp,'data/db.json'),JSON.stringify({users:['a','b'].map(id=>({id,username:id,displayName:id,role:'student',personalApiKey:'skill-test-'+id,canAccessChat:true})),chats:[{id:'room-a',userId:'a',title:'test',createdAt:new Date().toISOString(),messages:[]}],settings:{aiProvider:'local',hybridModeEnabled:false,lmStudioUrl:'http://127.0.0.1:17998',modelName:'mock'},curriculumWeekShiftVersion:1,courseContents:[],friendProfiles:[],friendships:[],directMessages:[],userPresences:{}}));
 await new Promise(r=>mock.listen(17998,'127.0.0.1',r));
 child=spawn(process.execPath,['--import',path.join(root,'node_modules/tsx/dist/loader.mjs'),path.join(root,'server.ts')],{cwd:temp,env:{...process.env,NODE_ENV:'production',PORT:'17997'},stdio:'ignore'});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/server-info')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready);
 for(const user of ['a','b'])assert.equal((await api(user,'/api/auth/me')).status,200);
 const skill={id:'skill-coding-tutor',type:'coding',name:'테스트 코딩친구',version:1,codingOptions:{codeGenMode:'hint',addComments:true}};
 assert.equal((await api('a','/api/user/ai-skills',{activeSkillId:skill.id,skills:[skill],testLogs:[],versionSnapshots:[],report:null})).status,200);
 assert.equal((await api('a','/api/user/ai-skills/activate',{skillId:'missing'})).status,400);
 assert.equal((await api('a','/api/user/ai-skills/activate',{skillId:skill.id})).status,200);
 assert.equal((await (await api('b','/api/user/ai-skills')).json()).aiSkillState.skills.length,0);
 assert.equal((await api('a','/api/user/ai-skills',{skills:'invalid'})).status,400);
 let response=await api('a','/api/ai-skills/test-chat',{text:'LED 켜는 코드',skill,history:[]});assert.equal(response.status,200);assert.equal((await response.json()).simulated,false);assert.match(captured.messages[0].content,/힌트/);assert.equal(captured.messages.filter(m=>m.role==='user').length,1);
 response=await api('a','/api/lmstudio/stream',{chatId:'room-a',messages:[{role:'system',content:'outdated client prompt'},{role:'user',content:'LED 켜는 코드'}]});assert.match(await response.text(),/\[DONE\]/);assert.match(captured.messages[0].content,/힌트/);assert.doesNotMatch(captured.messages[0].content,/outdated client prompt/);
 const checkCodingPrompt=()=>{
  const prompt=captured.messages[0].content;
  assert.match(prompt,/- 역할: 테스트 코딩친구/);
  assert.match(prompt,/작은 코딩 활동/);
  assert.match(prompt,/무지개는 왜 생겨/);
  assert.match(prompt,/코딩 연결을 원하지 않으면 강요하지/);
  assert.match(prompt,/근거 없이 특정 핀이나 코드를 원인으로 단정하지/);
 };
 response=await api('a','/api/ai-skills/test-chat',{text:'무지개는 왜생겨',skill,history:[]});assert.equal(response.status,200);await response.json();checkCodingPrompt();assert.equal(captured.messages.at(-1).content,'무지개는 왜생겨');
 response=await api('a','/api/lmstudio/stream',{chatId:'room-a',messages:[{role:'user',content:'무지개는 왜생겨'}]});await response.text();checkCodingPrompt();

 const study={id:'skill-study-helper',type:'study',name:'공부도우미',version:1,studyOptions:{subject:'science',method:'socratic',quizMode:true,provideSummaryNotes:true,cheerLevel:'high'}};
 const studyPrompts={};
 for(const method of ['socratic','analogy','summary']) {
  response=await api('a','/api/ai-skills/test-chat',{text:'무지개는 왜 생겨?',skill:{...study,studyOptions:{...study.studyOptions,method}},history:[]});assert.equal(response.status,200);await response.json();
  studyPrompts[method]=captured.messages[0].content;
 }
 assert.match(studyPrompts.socratic,/구체적인 질문 하나만 한 뒤 응답을 기다리/);
 assert.match(studyPrompts.socratic,/별도 질문이나 정답을 덧붙이지/);
 assert.match(studyPrompts.socratic,/정답을 드러내는 핵심 요약을 붙이지/);
 assert.doesNotMatch(studyPrompts.socratic,/설명을 마친 뒤 방금 배운/);
 assert.match(studyPrompts.analogy,/비유 하나로 설명을 시작/);
 assert.match(studyPrompts.analogy,/실제 개념의 무엇에 해당하는지/);
 assert.doesNotMatch(studyPrompts.analogy,/처음부터 완성된 정답이나 전체 원리를 설명하지/);
 assert.match(studyPrompts.summary,/1-2-3 목록/);
 assert.notEqual(studyPrompts.socratic,studyPrompts.analogy);

 const state=(await (await api('a','/api/user/ai-skills')).json()).aiSkillState;
 assert.equal(state.skills.filter(s=>s.type==='custom').length,3);
 for(const slot of [2,3]) {
  const entry=state.skills.find(s=>s.id===`skill-custom-builder-${slot}`);
  entry.customInputs={...entry.customInputs,skillName:`내 스킬 ${slot}`,mustDo:`SLOT_${slot}_RULE`};
 }
 state.activeSkillId='skill-custom-builder-2';
 assert.equal((await api('a','/api/user/ai-skills',state)).status,200);
 assert.equal((await api('a','/api/user/ai-skills/activate',{skillId:'skill-custom-builder-3'})).status,200);
 response=await api('a','/api/lmstudio/stream',{chatId:'room-a',messages:[{role:'user',content:'안녕'}]});await response.text();
 assert.match(captured.messages[0].content,/SLOT_3_RULE/);assert.doesNotMatch(captured.messages[0].content,/SLOT_2_RULE/);


 const draft=(await (await api('a','/api/user/ai-skills')).json()).aiSkillState;
 draft.skills.find(s=>s.id==='skill-custom-builder-3').customInputs.mustDo='UNAPPLIED_DRAFT';
 await api('a','/api/user/ai-skills',draft);
 response=await api('a','/api/lmstudio/stream',{chatId:'room-a',messages:[{role:'user',content:'안녕'}]});await response.text();
 assert.match(captured.messages[0].content,/SLOT_3_RULE/);assert.doesNotMatch(captured.messages[0].content,/UNAPPLIED_DRAFT/);
 await api('a','/api/user/ai-skills',{...draft,applySkillId:'skill-custom-builder-3'});
 response=await api('a','/api/lmstudio/stream',{chatId:'room-a',messages:[{role:'user',content:'안녕'}]});await response.text();assert.match(captured.messages[0].content,/UNAPPLIED_DRAFT/);
 const elder={id:'skill-custom-builder',type:'custom',name:'독거노인봇',version:1,customInputs:{skillName:'독거노인봇',forWhom:'혼자 사시는 노인',responseStyle:'손자 같은 말투',mustDo:'밝게 안부 묻기'}};
 response=await api('a','/api/ai-skills/test-chat',{text:'피곤해',skill:elder,history:[]});assert.equal(response.status,200);await response.json();
 assert.match(captured.messages[0].content,/따뜻한 존댓말/);assert.match(captured.messages[0].content,/독거노인봇/);assert.doesNotMatch(captured.messages[0].content,/AI 친구 정보|이름과 부르는 이름|공부친구/);

 // A selected English skill must override the ordinary friend persona in both paths.
 const english={id:'skill-english-buddy',type:'english',name:'영어친구 (English Buddy)',version:1,englishOptions:{level:'beginner',ratio:50,koreanHint:true,grammarCorrection:true,length:'short'}};
 const checkEnglishPrompt=()=>{
  const prompt=captured.messages[0].content;
  assert.match(prompt,/- 역할: 영어친구/);
  assert.match(prompt,/첫 질문을 바로/);
  assert.match(prompt,/실제 영어 표현을 포함/);
  assert.match(prompt,/What did you eat today/);
  assert.match(prompt,/마침표 생략을 영어 문법 오류로 취급하지/);
 };
 response=await api('a','/api/ai-skills/test-chat',{text:'무슨 이야기를 할까?',skill:english,history:[]});assert.equal(response.status,200);await response.json();checkEnglishPrompt();
 response=await api('a','/api/ai-skills/test-chat',{text:'넌 어떤 친구야?',skill:english,history:[{sender:'user',text:'무슨 이야기를 할까?'},{sender:'assistant',text:'What did you eat today?'}]});await response.json();checkEnglishPrompt();assert.equal(captured.messages[2].content,'What did you eat today?');
 const englishState=(await (await api('a','/api/user/ai-skills')).json()).aiSkillState;
 englishState.skills=englishState.skills.map(s=>s.id===english.id?english:s);
 assert.equal((await api('a','/api/user/ai-skills',{...englishState,applySkillId:english.id})).status,200);
 response=await api('a','/api/lmstudio/stream',{chatId:'room-a',messages:[{role:'user',content:'넌 어떤 친구야?'}]});await response.text();checkEnglishPrompt();

 const worksheet={studentName:'김소다',robotName:'루미',date:'2026-10-18',learned:[true,false,true,false],reflection:'LCD 실습',photo:'data:image/jpeg;base64,'+'A'.repeat(180000),intro:'내 친구',audience:'친구',purpose:'공부',rules:['하나','둘','셋'],question:'Q',before:'A',change:'규칙 변경',after:'B',good:'좋아요',difficult:'어려워요',next:'다음 목표'};
 const saved=(await (await api('a','/api/user/ai-skills')).json()).aiSkillState;
 saved.report={worksheet};assert.equal((await api('a','/api/user/ai-skills',saved)).status,200);
 assert.deepEqual((await (await api('a','/api/user/ai-skills')).json()).aiSkillState.report.worksheet,worksheet);
 offline=true;
 response=await api('a','/api/ai-skills/test-chat',{text:'실패 테스트',skill,history:[]});assert.equal(response.status,502);assert.equal((await response.json()).reply,undefined);
 assert.equal((await api('a','/api/ai-skills/test-chat',{text:123,skill})).status,400);
 console.log('PASS: skill persistence, account isolation, activation validation, exact test prompt, authoritative web prompt, non-simulated response, input validation');
}finally{child?.kill('SIGTERM');mock.closeAllConnections();await new Promise(r=>mock.close(r));if(child&&child.exitCode===null)await new Promise(r=>{child.once('exit',r);setTimeout(r,2000).unref()});await rm(temp,{recursive:true,force:true})}
