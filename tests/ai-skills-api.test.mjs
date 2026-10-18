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
 const skill={id:'test-coding',type:'coding',name:'테스트 코딩친구',version:1,codingOptions:{codeGenMode:'hint',addComments:true}};
 assert.equal((await api('a','/api/user/ai-skills',{activeSkillId:skill.id,skills:[skill],testLogs:[],versionSnapshots:[],report:null})).status,200);
 assert.equal((await api('a','/api/user/ai-skills/activate',{skillId:'missing'})).status,400);
 assert.equal((await api('a','/api/user/ai-skills/activate',{skillId:skill.id})).status,200);
 assert.equal((await (await api('b','/api/user/ai-skills')).json()).aiSkillState.skills.length,0);
 assert.equal((await api('a','/api/user/ai-skills',{skills:'invalid'})).status,400);
 let response=await api('a','/api/ai-skills/test-chat',{text:'LED 켜는 코드',skill,history:[]});assert.equal(response.status,200);assert.equal((await response.json()).simulated,false);assert.match(captured.messages[0].content,/힌트/);assert.equal(captured.messages.filter(m=>m.role==='user').length,1);
 response=await api('a','/api/lmstudio/stream',{chatId:'room-a',messages:[{role:'system',content:'outdated client prompt'},{role:'user',content:'LED 켜는 코드'}]});assert.match(await response.text(),/\[DONE\]/);assert.match(captured.messages[0].content,/힌트/);assert.doesNotMatch(captured.messages[0].content,/outdated client prompt/);
 offline=true;
 response=await api('a','/api/ai-skills/test-chat',{text:'실패 테스트',skill,history:[]});assert.equal(response.status,502);assert.equal((await response.json()).reply,undefined);
 assert.equal((await api('a','/api/ai-skills/test-chat',{text:123,skill})).status,400);
 console.log('PASS: skill persistence, account isolation, activation validation, exact test prompt, authoritative web prompt, non-simulated response, input validation');
}finally{child?.kill('SIGTERM');mock.closeAllConnections();await new Promise(r=>mock.close(r));if(child&&child.exitCode===null)await new Promise(r=>{child.once('exit',r);setTimeout(r,2000).unref()});await rm(temp,{recursive:true,force:true})}
