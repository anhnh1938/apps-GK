import { getFontEmbedCSS, toBlob } from 'html-to-image'
import JSZip from 'jszip'
import { downloadBlob } from '../../lib/file'
import { pad2 } from '../../lib/format'
import { EXPORT_DPI } from './constants'

// Ảnh 1×1 trong suốt thay cho ảnh không đọc được, để việc xuất không bị dừng
const BLANK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/** Class gắn lên <html> trong lúc xuất: ẩn số thứ tự ô, viền đỏ/xanh… để ảnh giống bản in */
export const EXPORTING_CLASS = 'sheet-exporting'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Ghi DPI vào PNG (khối pHYs ngay sau IHDR, byte 33) để Illustrator/Photoshop mở đúng khổ A4 */
async function setPngDpi(blob: Blob, dpi: number) {
  const src = new Uint8Array(await blob.arrayBuffer())
  const ppm = Math.round(dpi / 0.0254) // điểm ảnh / mét
  const chunk = new Uint8Array(21)
  const v = new DataView(chunk.buffer)
  v.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  v.setUint32(8, ppm)
  v.setUint32(12, ppm)
  chunk[16] = 1 // đơn vị: mét
  v.setUint32(17, crc32(chunk.subarray(4, 17)))
  const out = new Uint8Array(src.length + chunk.length)
  out.set(src.subarray(0, 33))
  out.set(chunk, 33)
  out.set(src.subarray(33), 33 + chunk.length)
  return new Blob([out], { type: 'image/png' })
}

/**
 * Chụp từng tờ A4 thành PNG (html-to-image = chính trình duyệt vẽ, nên chữ/nét đứt y như màn hình).
 * 1 tờ → <base>-A4-01.png; nhiều tờ → gói <base>.zip.
 */
export async function exportSheets(pages: HTMLElement[], baseName: string, onProgress: (text: string) => void) {
  const root = document.documentElement
  root.classList.add(EXPORTING_CLASS)
  try {
    await document.fonts.ready
    onProgress('Đang chuẩn bị…')
    const fontEmbedCSS = await getFontEmbedCSS(pages[0])
    const files: { name: string; blob: Blob }[] = []
    for (let i = 0; i < pages.length; i++) {
      onProgress(`Đang xuất tờ ${i + 1}/${pages.length}…`)
      const blob = await toBlob(pages[i], {
        pixelRatio: EXPORT_DPI / 96, // 1px CSS = 1/96 inch
        backgroundColor: '#ffffff',
        fontEmbedCSS,
        imagePlaceholder: BLANK_PNG,
        style: { margin: '0', boxShadow: 'none' },
      })
      if (!blob) throw new Error(`Tờ ${i + 1} xuất ra rỗng`)
      files.push({ name: `${baseName}-A4-${pad2(i + 1)}.png`, blob: await setPngDpi(blob, EXPORT_DPI) })
    }
    if (files.length === 1) {
      downloadBlob(files[0].blob, files[0].name)
    } else {
      const zip = new JSZip()
      files.forEach((f) => zip.file(f.name, f.blob))
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${baseName}.zip`)
    }
  } finally {
    root.classList.remove(EXPORTING_CLASS)
  }
}
