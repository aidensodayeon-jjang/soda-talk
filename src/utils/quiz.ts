export interface QuizQuestion {
  question: string;
  choices: string[];
  answer: number; // 1-based
  explanation: string;
}
export interface QuizState { question?: QuizQuestion; topic: string; }
// Older model-written quizzes have no trustworthy answer key. Never guess a grade.
export function hasUntrackedQuiz(messages: {sender:string; text:string}[]): boolean {
  const lastAssistant = [...messages].reverse().find(m => m.sender === 'assistant');
  return !!lastAssistant && /퀴즈|다음 문제|무엇을 선택/.test(lastAssistant.text)
    && /(?:[abc][).]|[123]번[.)]?)/i.test(lastAssistant.text);
}
const clean = (s: string) => s.toLowerCase().replace(/[\s.,!?。'"“”]/g, '');
export function parseQuizQuestion(raw: string): QuizQuestion {
  const q = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
  if (typeof q.question !== 'string' || !q.question.trim() || !Array.isArray(q.choices) || q.choices.length !== 3 || q.choices.some((c: unknown) => typeof c !== 'string' || !c.trim()) || new Set(q.choices.map(clean)).size !== 3 || !Number.isInteger(q.answer) || q.answer < 1 || q.answer > 3 || typeof q.explanation !== 'string' || !q.explanation.trim()) throw new Error('Invalid quiz');
  return {question:q.question, choices:q.choices, answer:q.answer, explanation:q.explanation};
}
export async function quizTurn(state: QuizState, text: string, generate: (topic: string) => Promise<QuizQuestion>): Promise<string | null> {
  const t = clean(text);
  if (state.question && /퀴즈.*(그만|취소|종료)|^(그만|취소|종료|다른이야기)/.test(t)) {
    delete state.question; return '퀴즈를 마쳤어요. 다른 이야기를 해볼까요?';
  }
  const newQuiz = /퀴즈|문제.*(내줘|내주세요|내봐|출제)/.test(t) || (!!state.topic && /^(다음|다른|새로운)(문제|퀴즈)?(줘|내줘|주세요)?$/.test(t));
  if (newQuiz) {
    const topic = /^(다음|다른|새로운)/.test(t) ? state.topic : text;
    // Keep the existing question if generation fails, so answers are never lost.
    try {
      const q = await generate(topic);
      state.topic = topic; state.question = q;
      return `${q.question}\n${q.choices.map((c,i)=>`${i+1}번. ${c}`).join('\n')}\n정답은 보기 번호나 내용으로 말해주세요.`;
    } catch { return '문제를 준비하지 못했어요. 잠시 후 “퀴즈 내줘”라고 다시 말해주세요.'; }
  }
  const q = state.question;
  if (!q) return null;
  if (/정답.*(알려|뭐|공개)|모르겠|모르겠어|모르겠어요|포기/.test(t)) {
    delete state.question;
    return `정답은 ${q.answer}번, ${q.choices[q.answer-1]}예요. ${q.explanation}\n다음 문제를 원하면 “다음 문제”라고 말해주세요.`;
  }
  if (/힌트/.test(t)) return `보기를 다시 읽어볼게요. ${q.choices.map((c,i)=>`${i+1}번 ${c}`).join(', ')}. 정답이라고 생각하는 번호를 말해주세요.`;
  const answerText = t.replace(/^(정답은?|답은?|저는?|나는?)/, '').replace(/(이라고답이|라고답이|이라고답했어|라고답했어|이라고|라고|입니다|이에요|예요|이야|같아|으로할게|을선택할게|를선택할게)$/,'');
  const aliases = [['1','1번','일번','첫번째','첫째','a','에이'],['2','2번','이번','두번째','둘째','b','비'],['3','3번','삼번','세번째','셋째','c','씨','시']];
  const matches = q.choices.map((c,i)=> clean(c) === answerText || aliases[i].includes(answerText) ? i+1 : 0).filter(Boolean);
  if (matches.length !== 1) return '답을 정확히 알아듣지 못했어요. 1번, 2번, 3번 중 하나로 다시 말해주세요. 퀴즈를 그만하려면 “퀴즈 그만”이라고 말해주세요.';
  delete state.question;
  return `${matches[0] === q.answer ? '맞았어요!' : '아쉬워요, 틀렸어요.'} 정답은 ${q.answer}번, ${q.choices[q.answer-1]}예요. ${q.explanation}\n다음 문제를 원하면 “다음 문제”라고 말해주세요.`;
}
