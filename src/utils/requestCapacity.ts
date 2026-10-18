// Single-process bounded queue. Keep accounts sequential while other accounts
// can use free slots; discard disconnected waiters before invoking a handler.
export function createRequestCapacity(
  maxActive = 8,
  identify: (req: any) => string = req => String(req.headers.authorization || ''),
  options: {maxWaiting?: number; maxWaitMs?: number} = {}
) {
  const active = new Set<string>();
  const waiting: {key:string; res:any; next:()=>void; timer:ReturnType<typeof setTimeout>; cancel:()=>void}[] = [];
  const maxWaiting = options.maxWaiting ?? 60;
  const maxWaitMs = options.maxWaitMs ?? 0;
  function start(key:string, res:any, next:()=>void) {
    active.add(key);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active.delete(key); res.off('finish',release); res.off('close',release);
      drain();
    };
    res.once('finish',release); res.once('close',release);
    next();
  }
  function drain() {
    while (active.size < maxActive) {
      const index = waiting.findIndex(item => !active.has(item.key));
      if (index < 0) break;
      const [item] = waiting.splice(index,1);
      clearTimeout(item.timer); item.res.off('close',item.cancel);
      if (!item.res.destroyed) start(item.key,item.res,item.next);
    }
  }
  return (req:any,res:any,next:()=>void) => {
    const key = identify(req);
    if (!key) return next();
    if (!active.has(key) && active.size < maxActive && waiting.length === 0) return start(key,res,next);
    if (waiting.length >= maxWaiting) {
      return res.status(503).json({error:'서버 대기열이 가득 찼습니다. 잠시 후 이용해주세요.'});
    }
    const item = {key,res,next,timer:undefined as unknown as ReturnType<typeof setTimeout>,cancel:()=>{}};
    item.cancel = () => {
      const index = waiting.indexOf(item);
      if (index >= 0) waiting.splice(index,1);
      clearTimeout(item.timer);res.off('close',item.cancel);
    };
    if (maxWaitMs > 0) item.timer = setTimeout(()=>{
      item.cancel();
      if (!res.destroyed) res.status(503).json({error:'서버 대기 시간이 길어 요청을 마치지 못했습니다. 잠시 후 이용해주세요.'});
    },maxWaitMs);
    res.once('close',item.cancel);
    waiting.push(item);
    drain();
  };
}
