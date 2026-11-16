/**
 * In riêng tem vận chuyển (<ShippingLabel>, khổ 100 × 150 mm) thay vì cả trang:
 * bật class printing-label (index.css ẩn #root, hiện tem) + đổi khổ giấy, in xong trả lại như cũ.
 * `onPrinted` chạy sau khi hộp thoại in đóng — dùng để đánh dấu "Đã in".
 */
export function printShippingLabel(onPrinted: () => void) {
  const root = document.documentElement
  const page = document.createElement('style')
  page.textContent = '@page { size: 100mm 150mm; margin: 0; }'
  document.head.appendChild(page)
  root.classList.add('printing-label')
  window.addEventListener(
    'afterprint',
    () => {
      root.classList.remove('printing-label')
      page.remove()
      onPrinted()
    },
    { once: true },
  )
  window.print()
}
