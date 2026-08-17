import { useEffect, useState } from 'react'

function formatWithCommas(raw) {
  if (raw === '' || raw === null || raw === undefined) return ''
  const [intPart, decPart] = String(raw).split('.')
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt
}

// A money-amount input that displays comma thousands-separators while
// typing (e.g. 1,200,000) but reports a plain numeric string back to the
// caller via onChange, same contract as a native `<input type="number">` —
// existing `parseFloat(form.amount)` call sites don't need to change.
export default function NumberInput({ value, onChange, className = 'input', ...props }) {
  const [display, setDisplay] = useState(formatWithCommas(value))

  useEffect(() => {
    setDisplay(formatWithCommas(value))
  }, [value])

  const handleChange = (e) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
    setDisplay(formatWithCommas(raw))
    onChange(raw)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      className={className}
      {...props}
    />
  )
}
