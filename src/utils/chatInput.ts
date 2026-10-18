// Enter used to commit an IME syllable must not submit/clear the input.
// Safari can report isComposing=false on that keydown, but still uses code 229.
export function preventImeSubmit(event: {
  key: string; isComposing?: boolean; keyCode?: number;
  nativeEvent?: {isComposing?: boolean; keyCode?: number};
  preventDefault: () => void;
}): boolean {
  if (event.key !== 'Enter') return false;
  const composing = event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229 || event.nativeEvent?.keyCode === 229;
  if (!composing) return false;
  event.preventDefault();
  return true;
}
