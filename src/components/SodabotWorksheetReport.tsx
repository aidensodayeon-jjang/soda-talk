import React, {useRef, useState} from 'react';
import {Cpu,Code2,Monitor,Music,Cloud,Wifi,Mic,Lightbulb,MousePointer2,Camera,Printer,Save,Bot} from 'lucide-react';
import type {AiSkillConfig,AiSkillProjectReport,SodabotWorksheet} from '../types';
import {worksheetDefaults,summary} from '../utils/worksheetReport';
import {WORKSHEET_CSS} from './worksheetStyles';

interface Props {report:AiSkillProjectReport;skill:AiSkillConfig;studentName:string;robotName:string;onChange:(report:AiSkillProjectReport)=>void;onSave:()=>Promise<void>;onFill:()=>void;status:string;}
export default function SodabotWorksheetReport({report,skill,studentName,robotName,onChange,onSave,onFill,status}:Props){
 const w={...worksheetDefaults(report,skill,studentName,robotName),...report.worksheet};
 const pages=useRef<HTMLDivElement>(null), frame=useRef<HTMLIFrameElement|null>(null);
 const [error,setError]=useState(''),[printing,setPrinting]=useState(false),[saving,setSaving]=useState(false),[editingIdentity,setEditingIdentity]=useState(false);
 const change=(key:keyof SodabotWorksheet,value:unknown)=>onChange({...report,worksheet:{...w,[key]:value},updatedAt:new Date().toISOString()});
 const field=(key:keyof SodabotWorksheet,label:string,placeholder='',limit=140,style?:React.CSSProperties)=><textarea aria-label={label} className="sw-field" value={String(w[key] || '')} placeholder={placeholder} maxLength={limit} onChange={e=>change(key,e.target.value)} style={style}/>;
 const photo=async(file?:File)=>{
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('JPG·PNG·WebP 사진을 선택해주세요.');return;}
  if(file.size>10*1024*1024){setError('사진은 10MB 이하로 선택해주세요.');return;}
  try{
   const bitmap=await createImageBitmap(file);const scale=Math.min(1,1100/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
   const ctx=canvas.getContext('2d');if(!ctx)throw Error();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   change('photo',canvas.toDataURL('image/jpeg',.82));setError('');
  }catch{setError('사진을 읽지 못했습니다. 다른 사진을 선택해주세요.');}
 };
 const print=async()=>{
  if(!pages.current)return;setPrinting(true);setError('');frame.current?.remove();
  try{
   const clone=pages.current.cloneNode(true) as HTMLElement;
   const source=pages.current.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input,textarea');
   clone.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input,textarea').forEach((input,index)=>{
    const original=source[index];const text=document.createElement('div');
    if(original instanceof HTMLInputElement && original.type==='checkbox'){text.className='sw-check-mark';text.textContent=original.checked?'☑':'☐';}
    else{text.className=input.className+' sw-print-text';text.style.cssText=input.style.cssText;text.textContent=original.value;}
    input.replaceWith(text);
   });
   clone.querySelectorAll('.sw-no-print').forEach(el=>el.remove());
   const iframe=document.createElement('iframe');frame.current=iframe;iframe.title='소다봇 보고서 인쇄';iframe.style.cssText='position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0';document.body.appendChild(iframe);
   const doc=iframe.contentDocument;if(!doc)throw Error();doc.open();doc.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>나만의 소다봇 보고서</title></head><body class="sw-wrap"></body></html>');doc.close();
   const style=doc.createElement('style');style.textContent=WORKSHEET_CSS;doc.head.appendChild(style);doc.body.appendChild(clone);
   await doc.fonts.ready;await Promise.all(Array.from(doc.images).map(img=>img.decode().catch(()=>{})));
   iframe.contentWindow?.addEventListener('afterprint',()=>{iframe.remove();if(frame.current===iframe)frame.current=null;},{once:true});
   iframe.contentWindow?.focus();iframe.contentWindow?.print();
  }catch{setError('인쇄 화면을 열지 못했습니다. 다시 눌러주세요.');frame.current?.remove();}
  finally{setPrinting(false);}
 };
 const identityFields=[['studentName','이름'],['date','작성일'],['robotName','로봇 이름']] as const;
 const identity=()=> <div className="sw-identity">{identityFields.map(([key,label])=><div className="sw-identity-value" key={key}><span>{label}</span><strong>{w[key] || '미입력'}</strong></div>)}</div>;
 const confirmIdentity=()=>{
  if(!w.studentName.trim() || !w.robotName.trim() || !w.date){setError('이름, 작성일, 로봇 이름을 모두 입력해주세요.');return;}
  change('identityConfirmed',true);setEditingIdentity(false);setError('');
 };
 const heading=(n:number,title:string,note='',mint=false)=><h2><span className={'sw-num'+(mint?' mint':'')}>{n}</span>{title}<small>{note}</small></h2>;
 const part=(Icon:any,title:string,description:string)=><div className="sw-card sw-part"><Icon size={30}/><div><strong>{title}</strong><p>{description}</p></div></div>;
 const footer=(n:number)=><footer className="sw-footer"><span>SODABOT STUDIO</span><span>{n} / 2</span></footer>;
 return <div className="sw-wrap"><style>{WORKSHEET_CSS}</style>
  <div className="sw-toolbar"><div><h2>나만의 소다봇 보고서</h2><p className="sw-note">A4 2장 · 아래에 직접 작성한 내용이 출력됩니다.</p><p role="status" className="sw-note">{status}</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={onFill}>테스트 기록 불러오기</button><button disabled={saving} onClick={async()=>{setSaving(true);try{await onSave();}finally{setSaving(false);}}}><Save size={14} style={{display:'inline'}}/> {saving?'저장 중…':'보고서 저장'}</button><button className="sw-primary" disabled={printing} onClick={print}><Printer size={14} style={{display:'inline'}}/> 인쇄 / PDF</button></div></div>
  <section className="sw-identity-setup sw-no-print" aria-label="보고서 기본 정보">
   <strong>보고서 기본 정보</strong>
   {!w.identityConfirmed || editingIdentity ? <><p className="sw-note">처음 한 번 입력하고 확인하면 두 페이지에 함께 반영됩니다.</p><div className="sw-identity-inputs">{identityFields.map(([key,label])=><label key={key}>{label}<input className="sw-field" aria-label={label} type={key==='date'?'date':'text'} maxLength={25} value={w[key]} onChange={e=>change(key,e.target.value)}/></label>)}</div><button type="button" onClick={confirmIdentity}>기본 정보 확인</button></> : <><p>{w.studentName} · {w.date} · {w.robotName}</p><button type="button" onClick={()=>setEditingIdentity(true)}>기본 정보 수정</button></>}
  </section>
  {error&&<p role="alert" className="sw-error">{error}</p>}
  <div className="sw-pages" ref={pages}>
   <article className="sw-page" aria-label="학습 요약 1페이지">
    <div className="sw-brand"><strong>소다사이언스랩</strong><span>나만의 AI 로봇을 만드는 공간</span></div>
    <header className="sw-title"><div><h1>소다봇, <em>이렇게 만들었어요</em></h1><p>회로부터 화면, 소리, AI 대화까지</p></div>{identity()}</header>
    <section className="sw-section">{heading(1,'나의 학습 여정','수업에서 이렇게 배웠어요.')}
     <div className="sw-journey">{[[Cpu,'회로 연결','부품을 연결하고 전원과 신호선을 확인했어요.'],[Code2,'코드 작성','버튼·화면·소리를 제어하는 코드를 만들었어요.'],[Monitor,'화면과 소리','LCD에 글자와 표정을 표시하고 소리를 냈어요.'],[Cloud,'AI 대화','Wi-Fi로 서버의 AI에 질문하고 답변을 받았어요.'],[Bot,'나만의 소다봇','배운 내용을 활용해 나만의 소다봇을 만들어요.']].map(([Icon,title,text]:any)=><div className="sw-card" key={title}><Icon size={29}/><h3>{title}</h3><p>{text}</p></div>)}</div>
    </section>
    <section className="sw-real-diagram" aria-label="소다봇은 어떻게 작동할까? 실물 버튼·마이크·ESP32·LED·LCD·앰프와 스피커 연결 그림">
     <img src="/images/sodabot-learning-worksheet.png" alt="실물 부품 사진과 연결선으로 설명한 소다봇 작동 원리. 마이크 입력이 Wi-Fi와 서버의 AI를 거쳐 화면과 스피커로 출력됩니다."/>
    </section>
    <section className="sw-section">{heading(3,'내가 익힌 핵심','완료한 항목을 체크해 보세요.')}
     <div className="sw-checks">{[[Cpu,'회로','전원·GND·신호선을 구분하고 연결하기'],[Code2,'코드','입력에 따라 LED·화면·소리 바꾸기'],[Wifi,'연결','Wi-Fi로 스튜디오와 소다봇 연결하기'],[Cloud,'AI','답변 규칙을 정하고 실제 대화로 확인하기']].map(([Icon,title,text]:any,i)=><label className="sw-card" key={title}><input type="checkbox" aria-label={`${title} 학습 완료`} checked={w.learned[i] || false} onChange={e=>change('learned',w.learned.map((v,j)=>i===j?e.target.checked:v))}/><Icon size={24}/><h3>{title}</h3><p>{text}</p></label>)}</div>
    </section>
    <section className="sw-section">{heading(4,'가장 기억에 남는 실습과 이유','재미있었거나 인상 깊었던 실습을 적어보세요.',true)}{field('reflection','기억에 남는 실습','어떤 실습이 가장 기억에 남나요? 왜 그런가요?',220,{height:'24mm'})}</section>
    {footer(1)}
   </article>
   <article className="sw-page" aria-label="나만의 소다봇 2페이지">
    <div className="sw-brand"><strong>SODABOT STUDIO</strong><span>나만의 AI 로봇을 만드는 공간</span></div>
    <header className="sw-title"><div><h1>내가 만든, <em>나만의 소다봇</em></h1><p>어떤 친구를 만들었고, 어떻게 대답했을까요?</p></div>{identity()}</header>
    <section className="sw-section">{heading(1,'내 소다봇 소개','사진과 함께 소개해요.')}
     <div className="sw-intro"><div className="sw-photo">{w.photo?<><img src={w.photo} alt="내가 만든 소다봇"/><button className="sw-remove sw-no-print" onClick={()=>change('photo','')}>사진 삭제</button></>:<><Camera size={38}/><p>내 소다봇 사진을 넣어주세요<br/>사진이 없어도 작성할 수 있어요.</p></>}<label className="sw-upload sw-no-print">사진 선택<input type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}} onChange={e=>{photo(e.target.files?.[0]);e.target.value='';}}/></label></div><div className="sw-intro-fields"><label>한 줄 소개{field('intro','한 줄 소개','어떤 친구인가요?',70,{height:'12mm'})}</label><label>누구를 위한 친구?{field('audience','스킬 대상','예: 친구, 가족, 나 자신',70,{height:'12mm'})}</label><label>어떤 도움을 주나요?{field('purpose','어떤 도움을 주나요','해결하고 싶은 문제',500,{height:'20mm'})}</label></div></div>
    </section>
    <section className="sw-section">{heading(2,'내가 정한 답변 규칙','내 소다봇은 이렇게 대답해요.',true)}<div className="sw-rules">{[0,1,2].map(i=><div className="sw-card" key={i}><h3>{i+1}. {['첫 번째 규칙','두 번째 규칙','세 번째 규칙'][i]}</h3><textarea className="sw-field" aria-label={`답변 규칙 ${i+1}`} value={w.rules[i] || ''} maxLength={95} placeholder={['예: 정답보다 힌트를 먼저 줘요.','예: 쉬운 예시로 설명해요.','예: 두 문장 이내로 대답해요.'][i]} onChange={e=>change('rules',w.rules.map((v,j)=>i===j?e.target.value:v))}/></div>)}</div></section>
    <section className="sw-section">{heading(3,'직접 시험해봤어요','같은 질문의 수정 전후 답변을 비교해요.')}<p className="sw-note">긴 답변은 출력용으로 요약해 작성하세요. 실제 테스트 기록은 별도로 유지됩니다.</p><div className="sw-comparison">{[['question','내가 한 질문','동일한 질문을 적어주세요.',160],['before','처음 받은 답변 요약','V1 답변을 요약해주세요.',240],['change','내가 바꾼 규칙','어떤 규칙을 바꿨나요?',140],['after','바꾼 뒤 답변 요약','새 버전의 답변을 요약해주세요.',240]].map(([key,label,placeholder,limit])=><div className="sw-card" key={String(key)}><h3>{label}</h3>{field(key as keyof SodabotWorksheet,String(label),String(placeholder),Number(limit))}</div>)}</div></section>
    <section className="sw-section">{heading(4,'나의 평가','잘된 점과 다음에 바꾸고 싶은 점을 적어보세요.')}<div className="sw-evaluation">{[['good','잘된 점'],['difficult','아쉬운 점'],['next','다음에 바꾸고 싶은 점']].map(([key,label])=><div className="sw-card" key={key}><h3>{label}</h3>{field(key as keyof SodabotWorksheet,label,'직접 느낀 점을 적어주세요.',150)}</div>)}</div></section>
    {footer(2)}
   </article>
  </div>
 </div>;
}
