import { uid } from '../../lib/file'

/** Một câu trên tờ mẫu câu (field `sentences` của báo giá) */
export interface Sentence {
  id: string
  text: string
}

/** Ô ảnh trên tờ mẫu câu */
export interface CellImage {
  id: string
  name: string
  src: string
}

/** Bỏ dòng trống thừa ở đầu/cuối và dấu cách thừa ở cuối mỗi dòng */
export const clean = (s: string) => s.replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, '')

export const toSentences = (texts: string[]): Sentence[] => texts.map((text) => ({ id: uid(), text }))

// "1. câu thứ nhất\n(xuống dòng)\n2. câu thứ hai" → 2 câu, giữ nguyên xuống dòng của khách.
// Không có số thứ tự thì mỗi đoạn (cách nhau 1 dòng trống) là 1 câu.
const NUM_RE = /^\s*\d+\s*[.)]\s+/

/** Nội dung in có đánh số 1. 2. 3. không (để ghi lại đúng kiểu người dùng đã gõ) */
export const isNumberedList = (text: string) =>
  String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .some((l) => NUM_RE.test(l))

/** Ngược với parseList: danh sách câu → nội dung in ("1. …\n2. …", hoặc các đoạn cách 1 dòng trống) */
export const serializeList = (texts: string[], numbered: boolean) =>
  numbered ? texts.map((t, i) => `${i + 1}. ${t}`).join('\n') : texts.join('\n\n')
export function parseList(text: string): string[] {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
  if (!lines.some((l) => NUM_RE.test(l))) {
    return clean(lines.join('\n'))
      .split(/\n\s*\n/)
      .map(clean)
      .filter(Boolean)
  }
  const out: string[] = []
  let cur: string | null = null
  for (const l of lines) {
    if (NUM_RE.test(l)) {
      if (cur !== null) out.push(cur)
      cur = l.replace(NUM_RE, '')
    } else if (cur !== null) cur += '\n' + l
  }
  if (cur !== null) out.push(cur)
  return out.map(clean).filter(Boolean)
}
