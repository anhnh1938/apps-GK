// localStorage có thể ném lỗi (chế độ ẩn danh, bị chặn, vượt dung lượng) — luôn bọc try/catch.

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Trả về false nếu không ghi được (thường do vượt dung lượng ~5 MB khi có ảnh). */
export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
