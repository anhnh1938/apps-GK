import { InputNumber } from 'antd'
import type { InputNumberProps } from 'antd'

const MAX = 999_999_999_999

type Props = Omit<InputNumberProps<number>, 'value' | 'onChange' | 'formatter' | 'parser' | 'min' | 'max'> & {
  value: number | null
  onChange: (value: number | null) => void
}

/** Ô nhập tiền VND: số nguyên ≥ 0, hiện "1.234.000", để trống = null. */
export function MoneyInput({ value, onChange, suffix = 'đ', style, ...rest }: Props) {
  return (
    <InputNumber<number>
      {...rest}
      value={value}
      onChange={(v) => onChange(v == null ? null : Math.floor(v))}
      min={0}
      max={MAX}
      controls={false}
      inputMode="numeric"
      suffix={suffix}
      formatter={(v) => (v == null ? '' : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.'))}
      // Trả chuỗi chỉ gồm chữ số: chuỗi rỗng được InputNumber hiểu là null (đúng ý "để trống")
      parser={(v) => (v ?? '').replace(/\D/g, '') as unknown as number}
      style={{ width: '100%', ...style }}
      styles={{ input: { textAlign: 'right' } }}
    />
  )
}
