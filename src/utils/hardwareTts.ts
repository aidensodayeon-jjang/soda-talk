// Buffer a whole response before playback: retrying a partial PCM stream would
// repeat spoken words or splice unrelated sample boundaries on the device.
export async function fetchHardwareSpeech(apiKey: string, text: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Buffer> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher('https://api.openai.com/v1/audio/speech', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${apiKey}`},
        body:JSON.stringify({model:'tts-1',voice:'nova',input:text,response_format:'pcm'}),
        signal
      });
      if (!response.ok) {
        await response.body?.cancel();
        const error = Object.assign(new Error(`TTS upstream HTTP ${response.status}`), {retryable:response.status === 429 || response.status >= 500});
        throw error;
      }
      const pcm = Buffer.from(await response.arrayBuffer());
      if (pcm.length === 0 || pcm.length % 2 !== 0) throw new Error('Incomplete TTS PCM response');
      return pcm;
    } catch (error: any) {
      if (signal.aborted || error?.name === 'AbortError' || error?.retryable === false || attempt === 1) throw error;
      // No PCM has been sent to the board, so one retry is safe.
    }
  }
  throw new Error('TTS failed');
}
