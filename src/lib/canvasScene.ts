export interface SceneFrame {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  t: number
  dt: number
}

// 单一 rAF 驱动；离屏/切后台暂停；reduced-motion 只渲染一帧静帧
export function createCanvasScene(
  canvas: HTMLCanvasElement,
  render: (frame: SceneFrame) => void,
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let w = 1
  let h = 1
  let raf = 0
  let last = 0
  let running = false
  let visible = !document.hidden
  let inView = true

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    w = Math.max(1, Math.round(rect.width))
    h = Math.max(1, Math.round(rect.height))
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (reduced) render({ ctx, w, h, t: 0, dt: 0 })
  }
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
    last = now
    render({ ctx, w, h, t: now / 1000, dt })
  }
  const update = () => {
    const should = visible && inView && !reduced
    if (should && !running) {
      running = true
      last = performance.now()
      raf = requestAnimationFrame(loop)
    } else if (!should && running) {
      running = false
      cancelAnimationFrame(raf)
    }
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  const io = new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting
    update()
  })
  io.observe(canvas)
  const onVisibility = () => {
    visible = !document.hidden
    update()
  }
  document.addEventListener('visibilitychange', onVisibility)
  resize()
  update()
  return () => {
    running = false
    cancelAnimationFrame(raf)
    ro.disconnect()
    io.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}