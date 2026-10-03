export const DEMO_MODE = true;

let seq = 1;
export function nextSeq(): number {
  return seq++;
}
