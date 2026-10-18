import type {AiSkillProjectReport, AiSkillConfig, SodabotWorksheet} from '../types';
export const summary = (text = '', limit = 240) => text.length > limit ? text.slice(0,limit-1) + '…' : text;
const observation = (text = '') => /아직 작성|실제 테스트를 보고|실제 수정 전후/.test(text) ? '' : text;
export function worksheetDefaults(report:AiSkillProjectReport, skill:AiSkillConfig, name:string, robotName:string):SodabotWorksheet {
  const logs = (report.actualLogs || []).filter(l => l.skillId === skill.id);
  const first=logs.find(l=>l.version===1);
  const later=logs.find(l=>l.version>1 && l.userQuestion.trim()===first?.userQuestion.trim());
  return {studentName:name,robotName,date:new Date().toLocaleDateString('en-CA'),learned:[false,false,false,false],reflection:'',photo:'',intro:'',
    audience:skill.type==='custom' ? skill.customInputs?.forWhom || '' : '',
    purpose:summary(skill.type==='custom' ? skill.customInputs?.targetProblem || '' : report.targetProblem,100),
    rules:skill.type==='custom' ? [skill.customInputs?.mustDo || '',skill.customInputs?.mustNotDo ? `하지 않기: ${skill.customInputs.mustNotDo}` : '',skill.customInputs?.responseStyle || ''] : ['','',''],
    question:summary(first?.userQuestion || '',160),before:summary(first?.aiResponse || ''),change:summary(observation(report.modifications),140),after:summary(later?.aiResponse || ''),
    good:summary(observation(report.goodPoints),150),difficult:summary(observation(report.painPoints),150),next:summary(observation(report.futureFeatures),150)};
}
