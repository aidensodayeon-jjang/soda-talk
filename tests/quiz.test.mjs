import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';
const {code}=await transform(readFileSync('src/utils/quiz.ts','utf8'),{loader:'ts',format:'esm'});
const {quizTurn,parseQuizQuestion,hasUntrackedQuiz}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const question={question:'우주를 연구하는 학자는?',choices:['물리학자','생물학자','천문학자'],answer:3,explanation:'천문학은 천체와 우주를 연구해요.'};
const generate=async()=>structuredClone(question);
test('question includes numbered choices and survives save/reload',async()=>{
 const s={topic:''};assert.match(await quizTurn(s,'퀴즈 하나 내줘',generate),/3번. 천문학자/);
 const reloaded=JSON.parse(JSON.stringify(s));assert.match(await quizTurn(reloaded,'삼 번',generate),/맞았어요!.*천문학/);assert.equal(reloaded.question,undefined);
});
test('wrong answer is graded and explained',async()=>{
 const s={topic:'',question:structuredClone(question)};assert.match(await quizTurn(s,'물리학자',generate),/틀렸어요.*3번/);
});
test('ambiguous speech does not lose the question or guess',async()=>{
 const s={topic:'',question:structuredClone(question)};assert.match(await quizTurn(s,'멀리갔다',generate),/다시 말해주세요/);assert.ok(s.question);assert.match(await quizTurn(s,'정답은 씨 예요',generate),/맞았어요/);
});
test('hint, reveal, next and cancel',async()=>{
 const s={topic:''};await quizTurn(s,'과학 퀴즈 내줘',generate);await quizTurn(s,'힌트',generate);assert.ok(s.question);
 assert.match(await quizTurn(s,'모르겠어',generate),/정답은 3번/);assert.equal(s.question,undefined);
 let topic;await quizTurn(s,'다음 문제',async t=>{topic=t;return generate()});assert.equal(topic,'과학 퀴즈 내줘');
 await quizTurn(s,'퀴즈 그만',generate);assert.equal(s.question,undefined);assert.equal(await quizTurn(s,'안녕',generate),null);
});
test('separate chats have independent questions; failures preserve pending question',async()=>{
 const a={topic:''},b={topic:''};await quizTurn(a,'퀴즈 내줘',generate);assert.equal(await quizTurn(b,'3번',generate),null);
 await quizTurn(a,'다른 퀴즈',async()=>{throw Error()});assert.ok(a.question);assert.match(await quizTurn(a,'3번',generate),/맞았어요/);
});
test('invalid generated keys and duplicate options are rejected',()=>{
 assert.deepEqual(parseQuizQuestion('```json\n'+JSON.stringify(question)+'\n```'),question);
 for(const q of [{...question,answer:0},{...question,choices:['a','a','c']},{...question,explanation:''}]) assert.throws(()=>parseQuizQuestion(JSON.stringify(q)));
});

test('reported spoken answer is graded as wrong rather than agreed with',async()=>{
 const s={topic:'science',question:structuredClone(question)};
 assert.match(await quizTurn(s,'물리학자라고 답이',generate),/틀렸어요.*3번/);
});
test('legacy free-form quizzes are detected without inventing an answer key',()=>{
 assert.equal(hasUntrackedQuiz([{sender:'assistant',text:'다음 문제: 우주 탐사? a) 물리학자 b) 생물학자 c) 천문학자 무엇을 선택해?'}]),true);
 assert.equal(hasUntrackedQuiz([{sender:'assistant',text:'안녕!'}]),false);
});
