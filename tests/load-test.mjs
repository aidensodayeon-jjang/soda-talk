// Isolated HTTP load test: no production data, board or paid provider calls.
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const root=process.cwd();
const temp=await mkdtemp(path.join(os.tmpdir(),'soda-load-'));
const port=17993, mockPort=17994;
let active=0, peak=0;
const mock=http.createServer(async(req,res)=>{
 for await(const ignored of req){}
 active++;peak=Math.max(peak,active);
 await new Promise(r=>setTimeout(r,500));
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 res.end('data: '+JSON.stringify({model:'load-test-mock',choices:[{delta:{content:'테스트 응답'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
 active--;
});
let child;
const base=`http://127.0.0.1:${port}`;
const api=async(route,key,body,method=body?'POST':'GET')=>fetch(base+route,{method,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const percentile=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.ceil(a.length*p)-1]||0;
try{
 await mkdir(path.join(temp,'data'));
 const users=Array.from({length:60},(_,i)=>({id:`load-${i}`,username:`load-${i}`,displayName:`부하테스트${i}`,role:'student',canAccessChat:true,personalApiKey:`load-test-key-${i}`}));
 const chats=users.map(u=>({id:`room-${u.id}`,userId:u.id,title:'load-test',createdAt:new Date().toISOString(),messages:[]}));
 await writeFile(path.join(temp,'data/db.json'),JSON.stringify({users,chats,settings:{aiProvider:'local',lmStudioUrl:`http://127.0.0.1:${mockPort}`,modelName:'load-test-mock',hybridModeEnabled:false,fallbackMode:false},courseContents:[],curriculumWeekShiftVersion:1,friendProfiles:[],friendships:[],directMessages:[],userPresences:{}}));
 await new Promise((resolve,reject)=>{mock.once('error',reject);mock.listen(mockPort,'127.0.0.1',resolve)});
 child=spawn(process.execPath,['--import',path.join(root,'node_modules/tsx/dist/loader.mjs'),path.join(root,'server.ts')],{cwd:temp,env:{...process.env,NODE_ENV:'production',PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 let ready=false;
 for(let i=0;i<100;i++){try{const r=await fetch(base+'/api/server-info');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
 if(!ready)throw Error('Test server failed: '+log.slice(-1000));
 await Promise.all(users.map(async u=>assert.equal((await api('/api/auth/me',u.personalApiKey)).status,200)));
 const results=[];
 for(const concurrency of [5,10,30,60]){
  const rows=await Promise.all(users.slice(0,concurrency).map(async u=>{
   const start=performance.now();const r=await api('/api/lmstudio/stream',u.personalApiKey,{chatId:`room-${u.id}`,model:'load-test-mock',messages:[{role:'user',content:'연결 테스트'}],stream:true});
   const body=await r.text();return {status:r.status,ms:performance.now()-start,complete:r.status===200&&body.includes('[DONE]')};
  }));
  const good=rows.filter(r=>r.status===200);const unexpected=rows.filter(r=>![200,429].includes(r.status));
  assert.equal(unexpected.length,0);assert.ok(good.every(r=>r.complete));assert.equal(good.length,concurrency);
  results.push({scenario:'simultaneous-ai',users:concurrency,success:good.length,busy429:rows.filter(r=>r.status===429).length,unexpectedErrors:unexpected.length,p50SuccessMs:Math.round(percentile(good.map(r=>r.ms),.5)),p95SuccessMs:Math.round(percentile(good.map(r=>r.ms),.95))});
 }
 // Sustained traffic below the cap: 6 users, 10 consecutive turns each.
 const latencies=[];const sustainedStart=performance.now();
 await Promise.all(users.slice(0,6).map(async u=>{for(let i=0;i<10;i++){
  const start=performance.now();const r=await api('/api/lmstudio/stream',u.personalApiKey,{chatId:`room-${u.id}`,model:'load-test-mock',messages:[{role:'user',content:'반복 테스트'}],stream:true});
  assert.equal(r.status,200);assert.match(await r.text(),/\[DONE\]/);latencies.push(performance.now()-start);
 }}));
 results.push({scenario:'sustained-ai',users:6,requests:latencies.length,success:latencies.length,durationMs:Math.round(performance.now()-sustainedStart),p95Ms:Math.round(percentile(latencies,.95))});
 // 60 accounts each saving 10 messages concurrently, no message may disappear.
 const start=performance.now();
 await Promise.all(users.flatMap(u=>Array.from({length:10},(_,i)=>(async()=>{
  const r=await api(`/api/chats/room-${u.id}/sync`,u.personalApiKey,{messages:[{id:`${u.id}-m-${i}`,sender:'user',text:`message-${i}`,timestamp:new Date().toISOString()}]});assert.equal(r.status,200);await r.arrayBuffer();
 })())));
 const db=JSON.parse(await readFile(path.join(temp,'data/db.json'),'utf8'));
 assert.ok(db.chats.every(c=>c.messages.length===10));assert.equal(db.chats.flatMap(c=>c.messages).length,600);
 results.push({scenario:'parallel-save',users:60,requests:600,savedMessages:600,lostMessages:0,durationMs:Math.round(performance.now()-start)});
 assert.ok(peak<=8);
 const report={time:new Date().toISOString(),environment:'isolated single Node server; mock AI upstream with 500ms latency; no real STT/TTS/LM calls',maxObservedUpstreamConcurrency:peak,results};
 await mkdir(path.join(root,'test-results'),{recursive:true});
 await writeFile(path.join(root,'test-results/load-test.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{
 child?.kill('SIGTERM');mock.closeAllConnections();await new Promise(r=>mock.close(r));
 if(child&&child.exitCode===null)await new Promise(r=>{child.once('exit',r);setTimeout(r,2000).unref()});
 await rm(temp,{recursive:true,force:true});
}
