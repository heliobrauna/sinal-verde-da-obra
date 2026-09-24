import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'

type NumericInputProps = Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
  value: number
  onValueChange: (value: number) => void
  decimals?: number
}

function format(value: number, decimals: number) {
  if (!Number.isFinite(value) || value === 0) return ''
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(value)
}

function parse(value: string, decimals: number) {
  const clean = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(clean)
  if (!Number.isFinite(parsed)) return 0
  const factor = 10 ** decimals
  return Math.round(parsed * factor) / factor
}

export function NumericInput({ value, onValueChange, decimals = 2, onBlur, onFocus, ...props }: NumericInputProps) {
  const [display, setDisplay] = useState(() => format(value, decimals))

  useEffect(() => setDisplay(format(value, decimals)), [value, decimals])

  return <Input {...props} type="text" inputMode="decimal" value={display}
    onFocus={event => { setDisplay(value ? String(value).replace('.', ',') : ''); onFocus?.(event) }}
    onChange={event => { setDisplay(event.target.value); onValueChange(parse(event.target.value, decimals)) }}
    onBlur={event => { setDisplay(format(parse(event.target.value, decimals), decimals)); onBlur?.(event) }} />
}