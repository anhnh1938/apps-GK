import { useState } from 'react'
import type { ShippingInfo } from './payment'
import { printShippingLabel } from './printLabel'
import { useAutosave } from './useAutosave'

type ShippingFields = Pick<ShippingInfo, 'carrier' | 'trackingCode'>

/** Đơn vị vận chuyển + mã vận đơn (tự lưu) và "In mã vận chuyển" (in xong đánh dấu đã in) */
export function useShipping(
  initial: ShippingInfo,
  save: (s: ShippingFields) => Promise<void>,
  markPrinted: () => Promise<void>,
  enabled: boolean,
) {
  const [value, setValue] = useState<ShippingFields>({ carrier: initial.carrier, trackingCode: initial.trackingCode })
  const [printedAt, setPrintedAt] = useState(initial.printedAt)
  const autosave = useAutosave(value, save, { enabled })
  const print = () =>
    printShippingLabel(() => {
      if (enabled) markPrinted().then(() => setPrintedAt(new Date()), console.error)
    })
  return { value, setValue, printedAt, autosave, print }
}
