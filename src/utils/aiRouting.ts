export function koreaDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function reserveGptRoute(user: {lastGptDate?:string;gptUsageCount?:number}, settings: {aiProvider?:string;hybridModeEnabled?:boolean;dailyGptQuota?:number}, now = new Date()): boolean {
  const today=koreaDay(now);
  if(user.lastGptDate!==today){user.lastGptDate=today;user.gptUsageCount=0;}
  const gpt=settings.aiProvider==='openai'||(settings.hybridModeEnabled===true&&(user.gptUsageCount||0)<(settings.dailyGptQuota??30));
  if(gpt)user.gptUsageCount=(user.gptUsageCount||0)+1;
  return gpt;
}
export async function withProviderFallback<T>(primaryGpt:boolean, attempt:(gpt:boolean)=>Promise<T>):Promise<T>{
  try{return await attempt(primaryGpt);}catch{return await attempt(!primaryGpt);}
}
