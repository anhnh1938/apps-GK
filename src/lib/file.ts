export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Không đọc được ảnh'))
      img.onload = () => (img.naturalWidth ? resolve(img) : reject(new Error('Ảnh rỗng')))
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function encode(img: HTMLImageElement, maxSize: number, type: string, quality: number) {
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas')
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(type, quality)
}

/**
 * Đọc ảnh thành data URL, cạnh dài nhất ≤ `maxSize` px.
 * Ảnh có thể trong suốt (PNG/GIF/WebP/SVG) giữ nền trong suốt, còn lại JPEG nền trắng.
 * `maxChars`: giới hạn độ dài data URL (Firestore: 1 document ≤ 1 MiB) — vượt thì nén mạnh hơn / thu nhỏ dần.
 */
export async function readImageFile(file: File, maxSize: number, maxChars = Infinity): Promise<string> {
  const img = await loadImage(file)
  const keepAlpha = /png|gif|webp|svg/.test(file.type)
  let size = maxSize
  let url = encode(img, size, keepAlpha ? 'image/png' : 'image/jpeg', 0.9)
  for (let i = 0; url.length > maxChars && i < 10; i++) {
    // PNG quá nặng → WebP (vẫn giữ nền trong suốt); sau đó thu nhỏ dần
    url = encode(img, size, keepAlpha ? 'image/webp' : 'image/jpeg', i === 0 ? 0.9 : 0.82)
    if (url.length > maxChars) size = Math.round(size * 0.8)
  }
  if (url.length > maxChars) throw new Error('Ảnh quá lớn')
  return url
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
