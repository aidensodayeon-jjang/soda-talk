// Integration test against an isolated server with three fictional accounts.
import {spawn} from 'node:child_process';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
const root=process.cwd(),temp=await mkdtemp(path.join(os.tmpdir(),'soda-friends-'));const base='http://127.0.0.1:17995';let child;
const users=['a','b','c'].map(id=>({id,username:id,displayName:'test-'+id,personalApiKey:'friends-test-'+id,role:'student'}));
const api=(user,url,body,method=body?'POST':'GET')=>fetch(base+url,{method,headers:{Authorization:'Bearer friends-test-'+user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
try{
 await mkdir(path.join(temp,'data'));await writeFile(path.join(temp,'data/db.json'),JSON.stringify({users,chats:[],settings:{},curriculumWeekShiftVersion:1,courseContents:[],friendProfiles:[],friendships:[{id:'ab',requesterId:'a',receiverId:'b',status:'accepted',createdAt:new Date().toISOString()}],directMessages:[],userPresences:{}}));
 child=spawn(process.execPath,['--import',path.join(root,'node_modules/tsx/dist/loader.mjs'),path.join(root,'server.ts')],{cwd:temp,env:{...process.env,NODE_ENV:'production',PORT:'17995'},stdio:'ignore'});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/server-info')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready);
 for(const u of users)assert.equal((await api(u.id,'/api/auth/me')).status,200);
 const sent=await api('a','/api/friends/messages/b',{content:'안녕'});assert.equal(sent.status,200);const dm=(await sent.json()).message;
 let notifications=await (await api('b','/api/friends/notifications/count')).json();assert.equal(notifications.unreadMessagesCount,1);
 const inbox=await (await api('b','/api/friends/messages/a')).json();assert.equal(inbox.messages[0].content,'안녕');assert.equal(inbox.messages[0].status,'read');
 notifications=await (await api('b','/api/friends/notifications/count')).json();assert.equal(notifications.unreadMessagesCount,0);
 assert.equal((await api('c','/api/friends/messages/a')).status,403);
 assert.equal((await api('c','/api/friends/messages/a',{content:'침입'})).status,403);
 assert.equal((await api('a','/api/friends/messages/b',{content:'x'.repeat(501)})).status,400);
 assert.equal((await api('c',`/api/friends/messages/${dm.id}/play-sodabot`,{})).status,403);
 assert.equal((await api('b',`/api/friends/messages/${dm.id}/play-sodabot`,{})).status,200);
 assert.equal((await (await api('b','/api/friends/messages/a')).json()).messages[0].playedOnSodabot,false);
 await api('b',`/api/friends/messages/${dm.id}/play-sodabot`,{played:true});
 assert.equal((await (await api('b','/api/friends/messages/a')).json()).messages[0].playedOnSodabot,true);
 assert.equal((await api('a','/api/friends/groups',{name:'bad',memberIds:['c']})).status,400);
 const created=await api('a','/api/friends/groups',{name:'test',memberIds:['b']});assert.equal(created.status,200);const room=(await created.json()).room;
 const route=`/api/friends/groups/${room.id}`;
 assert.equal((await api('c',route+'/messages')).status,403);
 assert.equal((await api('c',route+'/leave',{})).status,403);
 assert.equal((await api('a',route+'/messages',{content:123})).status,400);
 const groupSend=await api('b',route+'/messages',{content:'그룹 안녕'});assert.equal(groupSend.status,200);const gm=(await groupSend.json()).message;
 assert.equal((await api('c',`/api/friends/groups/messages/${gm.id}/play-sodabot`,{})).status,403);
 assert.equal((await api('a',route+'/invite',{memberIds:['c']})).status,400);
 const groupInbox=await (await api('a',route+'/messages')).json();assert.ok(groupInbox.messages.find(m=>m.id===gm.id).readBy.includes('a'));
 const many=await Promise.all(Array.from({length:40},(_,i)=>api(i%2?'a':'b',`/api/friends/messages/${i%2?'b':'a'}`,{content:'parallel-'+i})));assert.ok(many.every(r=>r.status===200));
 const final=await (await api('a','/api/friends/messages/b')).json();assert.equal(final.messages.length,41);assert.equal(new Set(final.messages.map(m=>m.id)).size,41);

 // Extended group lifecycle and simultaneous requests.
 await api('a','/api/friends/request',{targetUserId:'c'});
 const pending=await (await api('c','/api/friends/requests')).json();
 assert.equal((await api('c','/api/friends/respond',{requestId:pending.incoming[0].id,action:'accept'})).status,200);
 const invites=await Promise.all(Array.from({length:10},()=>api('a',route+'/invite',{memberIds:['c','c']})));
 assert.ok(invites.every(r=>r.status===200));
 let groups=(await (await api('a','/api/friends/groups')).json()).groups;
 assert.equal(groups.find(g=>g.id===room.id).memberIds.filter(id=>id==='c').length,1);
 assert.match(groups.find(g=>g.id===room.id).lastMessage.content,/초대/);
 const groupWrites=await Promise.all(Array.from({length:40},(_,i)=>api(i%2?'a':'b',route+'/messages',{content:'group-parallel-'+i})));
 assert.ok(groupWrites.every(r=>r.status===200));
 const history=(await (await api('c',route+'/messages')).json()).messages;
 assert.equal(history.filter(m=>m.content.startsWith('group-parallel-')).length,40);
 assert.equal(new Set(history.map(m=>m.id)).size,history.length);
 assert.equal((await api('c',route+'/leave',{})).status,200);
 assert.equal((await api('c',route+'/messages',{content:'after leave'})).status,403);
 assert.equal((await api('c',route+'/messages')).status,403);
 groups=(await (await api('a','/api/friends/groups')).json()).groups;
 assert.match(groups.find(g=>g.id===room.id).lastMessage.content,/나갔/);
 const rooms=await Promise.all(Array.from({length:10},(_,i)=>api('a','/api/friends/groups',{name:'room-'+i,memberIds:['b']}).then(r=>r.json())));
 assert.equal(new Set(rooms.map(r=>r.room.id)).size,10);
 assert.equal((await api('a',route+'/leave',{})).status,200);assert.equal((await api('a',route+'/messages')).status,403);

 const successor=(await (await api('b',route+'/messages')).json()).room;
 assert.equal(successor.creatorId,'b');
 assert.equal((await api('b',route+'/leave',{})).status,200);
 assert.equal((await api('b',route+'/messages')).status,404);
 assert.ok(!(await (await api('b','/api/friends/groups')).json()).groups.some(g=>g.id===room.id));
 assert.equal((await api('b','/api/friends/block',{targetUserId:'a'})).status,200);assert.equal((await api('a','/api/friends/messages/b',{content:'blocked'})).status,403);
 console.log('PASS: extended groups (duplicate invitations, 40 concurrent group messages, unique IDs, summaries, ownership transfer, final deletion),  DM send/receive, unread/read, 40 concurrent sends, group messages/read/leave, blocking, nonmember isolation, invitation validation, malformed/oversized input');
}finally{child?.kill('SIGTERM');if(child&&child.exitCode===null)await new Promise(r=>{child.once('exit',r);setTimeout(r,2000).unref()});await rm(temp,{recursive:true,force:true})}
