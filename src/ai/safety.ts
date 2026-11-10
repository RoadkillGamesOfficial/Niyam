// Distress signals are checked before the model is called, so the safety path
// works even when Ollama is down (R7, REF-6). This is deliberately a small list
// of explicit phrases, not a classifier: it must never fire on ordinary stress
// language, and the prompt repeats the instruction for anything subtler.
const DISTRESS_SIGNALS: RegExp[] = [
  /\bkill(ing)? myself\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend (my|it all) (life|tonight)\b/i,
  /\bself[-\s]?harm(ing)?\b/i,
  /\bhurt(ing)? myself\b/i,
  /\bno reason to (live|be here)\b/i,
  /\bbetter off dead\b/i,
  /\bcan'?t go on\b/i,
  /\bdon'?t want to (be here|live|exist)\b/i,
];

export function detectDistress(text: string): boolean {
  return DISTRESS_SIGNALS.some((pattern) => pattern.test(text));
}
