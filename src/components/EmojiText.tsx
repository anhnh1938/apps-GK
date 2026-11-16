import { useMemo, useState } from 'react'

// Emoji hiện bằng ảnh Apple (giống iPhone của khách), kể cả khi mở trên Windows.
const EMOJI_CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/'
const EMOJI_RE =
  /\p{Regional_Indicator}{2}|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)(?:\p{Emoji_Modifier}|️|‍(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️?))*/gu

type Part = string | { emoji: string }

function splitEmoji(text: string): Part[] {
  const parts: Part[] = []
  let last = 0
  for (const m of text.matchAll(EMOJI_RE)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push({ emoji: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function AppleEmoji({ seq, className }: { seq: string; className?: string }) {
  // Tên file = mã codepoint nối bằng "-". Đôi khi khác cách gõ (thừa/thiếu FE0F): thử lại bản bỏ FE0F,
  // không được nữa thì để emoji dạng chữ của máy.
  const names = useMemo(() => {
    const codes = Array.from(seq, (ch) => ch.codePointAt(0)!.toString(16))
    const full = codes.join('-')
    const noVS = codes.filter((c) => c !== 'fe0f').join('-')
    return noVS === full ? [full] : [full, noVS]
  }, [seq])
  const [attempt, setAttempt] = useState(0)

  if (attempt >= names.length) return seq
  return (
    <img
      className={className}
      src={`${EMOJI_CDN}${names[attempt]}.png`}
      alt={seq}
      draggable={false}
      crossOrigin="anonymous"
      onError={() => setAttempt((a) => a + 1)}
    />
  )
}

/** Hiển thị chữ, thay emoji bằng ảnh Apple. `emojiClassName` quyết định cỡ ảnh (thường ~1.2em). */
export function EmojiText({ text, emojiClassName }: { text: string; emojiClassName?: string }) {
  const parts = useMemo(() => splitEmoji(text), [text])
  return parts.map((p, i) =>
    typeof p === 'string' ? p : <AppleEmoji key={`${i}-${p.emoji}`} seq={p.emoji} className={emojiClassName} />,
  )
}
