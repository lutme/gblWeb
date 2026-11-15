<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createCanvasScene } from '@/lib/canvasScene'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let destroy: (() => void) | null = null

const PLANKTON_HUES = [
  [70, 230, 224],
  [96, 200, 255],
  [111, 183, 255],
  [180, 108, 255],
] as const

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  const plankton = Array.from({ length: 64 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.7 + Math.random() * 1.9,
    ph: Math.random() * Math.PI * 2,
    speed: 0.35 + Math.random() * 0.8,
    dx: (Math.random() - 0.5) * 0.006,
    dy: (Math.random() - 0.5) * 0.004,
    hue: PLANKTON_HUES[Math.random() < 0.12 ? 3 : Math.floor(Math.random() * 3)],
  }))
  const currents = Array.from({ length: 6 }, () => ({
    x: Math.random(),
    y: 0.15 + Math.random() * 0.75,
    len: 0.12 + Math.random() * 0.2,
    s: 0.008 + Math.random() * 0.014,
    a: 0.04 + Math.random() * 0.05,
  }))
  const snow = Array.from({ length: 26 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.5 + Math.random() * 1.1,
    s: 0.004 + Math.random() * 0.008,
    a: 0.04 + Math.random() * 0.07,
  }))

  destroy = createCanvasScene(canvas, ({ ctx, w, h, t, dt }) => {
    ctx.clearRect(0, 0, w, h)
    // 声呐环：未测绘海域的探测隐喻，两环错相保持连续
    for (const offset of [0, 3.5]) {
      const age = ((t + offset) % 7) / 7
      const radius = age * Math.max(w, h) * 0.72
      const alpha = (1 - age) * 0.09
      ctx.strokeStyle = `rgba(70, 230, 224, ${alpha})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(w * 0.5, h * 0.88, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (const c of currents) {
      c.x += c.s * dt
      if (c.x - c.len > 1.05) c.x = -0.05
      const x0 = (c.x - c.len) * w
      const x1 = c.x * w
      const y = c.y * h
      const g = ctx.createLinearGradient(x0, y, x1, y)
      g.addColorStop(0, 'rgba(96, 200, 255, 0)')
      g.addColorStop(0.7, `rgba(96, 200, 255, ${c.a})`)
      g.addColorStop(1, 'rgba(96, 200, 255, 0)')
      ctx.strokeStyle = g
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(x1, y)
      ctx.stroke()
    }
    for (const p of snow) {
      p.y += p.s * dt
      if (p.y > 1.02) {
        p.y = -0.02
        p.x = Math.random()
      }
      ctx.fillStyle = `rgba(170, 200, 235, ${p.a})`
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    // 生物荧光：脉冲发光，偶发强闪
    ctx.globalCompositeOperation = 'lighter'
    for (const p of plankton) {
      p.x += p.dx * dt
      p.y += p.dy * dt
      if (p.x > 1.02) p.x = -0.02
      else if (p.x < -0.02) p.x = 1.02
      if (p.y > 1.02) p.y = -0.02
      else if (p.y < -0.02) p.y = 1.02
      const wave = 0.5 + 0.5 * Math.sin(t * p.speed + p.ph)
      const flash = wave > 0.985 ? 1.8 : 1
      const alpha = (0.06 + 0.3 * wave * wave) * flash
      const [r, g, b] = p.hue
      const glow = ctx.createRadialGradient(p.x * w, p.y * h, 0, p.x * w, p.y * h, p.r * 6)
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`)
      glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, p.r * 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.85, alpha * 2)})`
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  })

  onBeforeUnmount(() => destroy?.())
})
</script>

<template>
  <div class="abyss-bg" aria-hidden="true">
    <div class="abyss-depth"></div>
    <div class="abyss-glow"></div>
    <div class="abyss-fog abyss-fog-a"></div>
    <div class="abyss-fog abyss-fog-b"></div>
    <canvas ref="canvasRef" class="abyss-canvas"></canvas>
    <div class="abyss-vignette"></div>
  </div>
</template>

<style scoped>
.abyss-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.abyss-depth {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #010409 0%, #020a18 46%, #041226 100%);
}
.abyss-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(58% 42% at 50% 110%, rgba(38, 118, 198, 0.2), transparent 72%);
}
.abyss-fog {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
}
.abyss-fog-a {
  width: 620px;
  height: 380px;
  left: -160px;
  bottom: -120px;
  background: radial-gradient(ellipse, rgba(16, 60, 110, 0.5), transparent 70%);
  animation: fog-drift-a 24s ease-in-out infinite alternate;
}
.abyss-fog-b {
  width: 520px;
  height: 340px;
  right: -140px;
  top: 18%;
  background: radial-gradient(ellipse, rgba(64, 46, 130, 0.32), transparent 70%);
  animation: fog-drift-b 30s ease-in-out infinite alternate;
}
@keyframes fog-drift-a {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(70px, -30px, 0) scale(1.12); }
}
@keyframes fog-drift-b {
  from { transform: translate3d(0, 0, 0) scale(1.06); }
  to { transform: translate3d(-60px, 40px, 0) scale(0.94); }
}
.abyss-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.abyss-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(115% 90% at 50% 46%, transparent 46%, rgba(0, 2, 6, 0.86) 100%);
}
@media (prefers-reduced-motion: reduce) {
  .abyss-fog {
    animation: none;
  }
}
</style>