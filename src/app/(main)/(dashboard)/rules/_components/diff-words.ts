export type DiffPart = { text: string; changed: boolean };

const tokenize = (text: string) => text.split(/(\s+)/).filter((token) => token.length > 0);
const isSpace = (token: string) => /^\s+$/.test(token);

/**
 * Пословное сравнение «было / стало» (наибольшая общая подпоследовательность).
 * Возвращает части для каждой стороны: changed = слово удалено (слева) или добавлено (справа).
 */
export function diffWords(before: string, after: string): { before: DiffPart[]; after: DiffPart[] } {
  const a = tokenize(before);
  const b = tokenize(after);

  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const left: DiffPart[] = [];
  const right: DiffPart[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      left.push({ text: a[i], changed: false });
      right.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      left.push({ text: a[i], changed: !isSpace(a[i]) });
      i++;
    } else {
      right.push({ text: b[j], changed: !isSpace(b[j]) });
      j++;
    }
  }
  for (; i < a.length; i++) left.push({ text: a[i], changed: !isSpace(a[i]) });
  for (; j < b.length; j++) right.push({ text: b[j], changed: !isSpace(b[j]) });

  return { before: left, after: right };
}
