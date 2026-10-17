import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {faceCode,replaceFunction,soundCode,replaceLed} from '../public/simulations/lcd-expression-lab/settings-model.js';
import {compileExpression} from '../public/simulations/lcd-expression-lab/expression-engine.js';
const source=readFileSync('firmware/soda-expression.ino','utf8');
test('표정 UI 설정을 실제 코드와 출력으로 반영',()=>{const face=faceCode({target:'happy',eyes:'square',mouth:'open',radius:20,foreground:'GREEN',background:'BLUE'});const code=replaceFunction(source,face.name,face.body);const p=compileExpression(code,source);assert.equal(p.press(1).bg,'#3b82f6');assert.equal(p.press(1).shapes[0].type,'fillRect');assert.equal(p.press(1).shapes[0].color,'#22c55e');assert.deepEqual(p.initial(),compileExpression(source,source).initial());});
test('효과음과 LED 시간 UI 설정을 코드로 반영',()=>{const code=replaceLed(replaceFunction(source,'playFeedback',soundCode([{frequency:440,duration:200},{frequency:550,duration:300},{frequency:660,duration:400}])),1500);const p=compileExpression(code,source);assert.equal(p.hold,1500);assert.equal(p.tones[0].frequency,440);assert.equal(p.duration,2400);});
test('허용 범위 밖 설정 거부',()=>{assert.throws(()=>replaceLed(source,10001));assert.throws(()=>soundCode([{frequency:0,duration:10}]));assert.throws(()=>replaceFunction(source,'loop',''));});
