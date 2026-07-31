import { useRef, useState, useImperativeHandle, forwardRef } from 'react'

const SignaturePad = forwardRef(function SignaturePad(_props, ref) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  const getPoint = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const start = (e) => {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPoint(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e3a5f'
    ctx.lineTo(x, y)
    ctx.stroke()
    setIsEmpty(false)
  }

  const end = () => {
    drawing.current = false
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }

  useImperativeHandle(ref, () => ({
    clear,
    isEmpty: () => isEmpty,
    getDataUrl: () => canvasRef.current.toDataURL('image/png'),
  }))

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={160}
        className="w-full h-40 border border-gray-200 rounded-lg bg-white touch-none cursor-crosshair"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <button type="button" onClick={clear} className="text-xs text-gray-500 hover:text-brand mt-1.5">
        Clear signature
      </button>
    </div>
  )
})

export default SignaturePad
