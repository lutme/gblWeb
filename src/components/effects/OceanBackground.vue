<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createCanvasScene } from '@/lib/canvasScene'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let destroy: (() => void) | null = null
let pointerX = 0.5

interface Bubble {
  x: number
  y: number
  r: number
  s: number
  wob: number
  ws: number
  a: number
}

function spawnBubble(anywhere: boolean): Bubble {
  return {
    x: Math.random(),
    y: anywhere ? Math.random() : 1 + Math.random() * 0.1,
    r: 1 + Math.random() * 3.2,
    s: 0.03 + Math.random() * 0.06,
    wob: Math.random() * Math.PI * 2,
    ws: 0.6 + Math.random() * 1.2,
    a: 0.1 + Math.random() * 0.2,
  }
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  const bubbles = Array.from({ length: 26 }, () => spawnBubble(true))
  const snow = Array.from({ length: 70 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.6 + Math.random() * 1.4,
    s: 0.008 + Math.random() * 0.02,
    ph: Math.random() * Math.PI * 2,
    a: 0.05 + Math.random() * 0.12,
  }))
  const onPointer = (e: PointerEvent) => {
    pointerX = e.clientX / Math.max(1, window.innerWidth)
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  destroy = createCanvasScene(canvas, ({ ctx, w, h, t, dt }) => {
    ctx.clearRect(0, 0, w, h)
    for (const p of snow) {
      p.y += p.s * dt
      p.x += Math.sin(t * 0.3 + p.ph) * 0.00006 + (pointerX - 0.5) * 0.00005
      if (p.y > 1.02) {
        p.y = -0.02
        p.x = Math.random()
      }
      if (p.x > 1.02) p.x = -0.02
      else if (p.x < -0.02) p.x = 1.02
      ctx.fillStyle = `rgba(190, 220, 255, ${p.a})`
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const b of bubbles) {
      b.y -= b.s * dt
      b.wob += b.ws * dt
      if (b.y < -0.05) Object.assign(b, spawnBubble(false))
      const x = (b.x + Math.sin(b.wob) * 0.008) * w
      const y = b.y * h
      ctx.strokeStyle = `rgba(170, 220, 255, ${b.a})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(x, y, b.r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = `rgba(224, 246, 255, ${b.a * 0.9})`
      ctx.beginPath()
      ctx.arc(x - b.r * 0.35, y - b.r * 0.35, Math.max(0.4, b.r * 0.22), 0, Math.PI * 2)
      ctx.fill()
    }
  })

  onBeforeUnmount(() => {
    destroy?.()
    window.removeEventListener('pointermove', onPointer)
  })
})
</script>

<template>
  <div class="ocean-bg" aria-hidden="true">
    <div class="ocean-depth"></div>
    <div class="ocean-surface"></div>
    <canvas ref="canvasRef" class="ocean-canvas"></canvas>
  </div>
</template>

<style scoped>
.ocean-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.ocean-depth {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #0b2444 0%, #091d3a 38%, #071731 72%, #061126 100%);
}
.ocean-surface {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(62% 40% at 50% -10%, rgba(111, 183, 255, 0.2), transparent 70%),
    radial-gradient(46% 34% at 82% 4%, rgba(124, 108, 255, 0.09), transparent 70%);
}
.ocean-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>