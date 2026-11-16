import type { ReactNode } from 'react'
import { DatePicker, Input, Segmented } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { DateRange } from '../lib/format'
import s from './ListToolbar.module.css'

const today = () => dayjs()
const DATE_PRESETS = [
  { label: 'Hôm nay', value: () => [today().startOf('day'), today().endOf('day')] },
  { label: '7 ngày qua', value: () => [today().subtract(6, 'day').startOf('day'), today().endOf('day')] },
  { label: '30 ngày qua', value: () => [today().subtract(29, 'day').startOf('day'), today().endOf('day')] },
  { label: 'Tháng này', value: () => [today().startOf('month'), today().endOf('month')] },
  {
    label: 'Tháng trước',
    value: () => [today().subtract(1, 'month').startOf('month'), today().subtract(1, 'month').endOf('month')],
  },
] as const

/** Ô chọn khoảng ngày có các mốc nhanh (Hôm nay, 7 / 30 ngày, tháng này, tháng trước) */
export function DateRangeFilter({
  value,
  onChange,
  placeholder,
  allowClear = true,
}: {
  value: DateRange
  onChange: (v: DateRange) => void
  placeholder: [string, string]
  allowClear?: boolean
}) {
  return (
    <DatePicker.RangePicker
      value={value ? [dayjs(value[0]), dayjs(value[1])] : null}
      onChange={(v) => onChange(v?.[0] && v[1] ? [v[0].startOf('day').toDate(), v[1].endOf('day').toDate()] : null)}
      format="DD/MM/YYYY"
      placeholder={placeholder}
      presets={DATE_PRESETS.map((p) => ({ label: p.label, value: p.value() as [dayjs.Dayjs, dayjs.Dayjs] }))}
      allowClear={allowClear}
    />
  )
}

/** Hàng lọc của trang danh sách: trạng thái (kèm số lượng) + khoảng ngày + ô tìm kiếm */
export function ListFilters<T extends string>({
  statuses,
  counts,
  filter,
  onFilter,
  dateRange,
  onDateRange,
  datePlaceholder,
  search,
  onSearch,
  placeholder,
}: {
  statuses: readonly { value: T; label: string }[]
  counts: Record<string, number>
  filter: T | 'all'
  onFilter: (v: T | 'all') => void
  dateRange: DateRange
  onDateRange: (v: DateRange) => void
  /** Ô ngày lọc theo field nào, VD ['Báo giá từ ngày', 'Đến ngày'] */
  datePlaceholder: [string, string]
  search: string
  onSearch: (v: string) => void
  placeholder: string
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return (
    <div className={s.filters}>
      <Segmented<T | 'all'>
        value={filter}
        onChange={onFilter}
        options={[
          { value: 'all', label: `Tất cả (${total})` },
          ...statuses.map((st) => ({ value: st.value, label: `${st.label} (${counts[st.value] ?? 0})` })),
        ]}
      />
      <div className={s.right}>
        <DateRangeFilter value={dateRange} onChange={onDateRange} placeholder={datePlaceholder} />
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{ width: 260 }}
        />
      </div>
    </div>
  )
}

/** Ô số liệu nhỏ phía trên bảng */
export function Stats({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className={s.stats}>
      {items.map((it) => (
        <div key={it.label} className={s.stat}>
          <div className={s.statLabel}>{it.label}</div>
          <div className={s.statValue}>{it.value}</div>
        </div>
      ))}
    </div>
  )
}

/** Dòng phụ màu xám dưới ô chính trong bảng */
export function SubText({ children }: { children: ReactNode }) {
  return <span className={s.sub}>{children}</span>
}
