<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '@/components/CodeBlock.vue'
import { middlewareCode } from '@/content/samples'
import { revealOnScroll, prefersReducedMotion } from '@/lib/motion'

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)
const reduced = ref(false)

onMounted(() => {
  reduced.value = prefersReducedMotion()
  if (root.value) revealOnScroll(root.value)
})
</script>

<template>
  <section id="onion" ref="root" class="section onion">
    <div class="container onion-grid">
      <div class="onion-visual reveal">
        <svg viewBox="0 0 420 440" class="onion-svg" role="img" :aria-label="t('onion.title')">
          <defs>
            <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(70,230,224,0.35)" />
              <stop offset="100%" stop-color="rgba(70,230,224,0)" />
            </radialGradient>
            <filter id="dot-glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="210" cy="220" r="186" class="ring ring-outer" />
          <circle cx="210" cy="220" r="130" class="ring ring-mid" />
          <circle cx="210" cy="220" r="74" class="ring ring-core" />
          <circle cx="210" cy="220" r="74" fill="url(#core-glow)" />

          <text x="210" y="52" class="ring-label">{{ t('onion.engineMw') }}</text>
          <text x="210" y="108" class="ring-label mid">{{ t('onion.groupMw') }}</text>
          <text x="210" y="225" class="ring-label core">{{ t('onion.handlerNode') }}</text>

          <text x="210" y="18" class="phase-label req">{{ t('onion.requestPhase') }} ↓</text>
          <text x="210" y="434" class="phase-label res">↑ {{ t('onion.responsePhase') }}</text>

          <line x1="210" y1="24" x2="210" y2="416" class="axis" />

          <template v-if="!reduced">
            <circle r="6" class="dot-req" filter="url(#dot-glow)">
              <animateMotion dur="2.2s" repeatCount="indefinite" path="M210,24 L210,220" />
            </circle>
            <circle r="6" class="dot-res" filter="url(#dot-glow)">
              <animateMotion dur="2.2s" repeatCount="indefinite" path="M210,220 L210,416" />
            </circle>
          </template>
          <template v-else>
            <circle cx="210" cy="120" r="6" class="dot-req" />
            <circle cx="210" cy="320" r="6" class="dot-res" />
          </template>
        </svg>
      </div>

      <div class="onion-copy">
        <p class="eyebrow reveal">{{ t('onion.eyebrow') }}</p>
        <h2 class="section-title reveal">{{ t('onion.title') }}</h2>
        <p class="section-sub reveal">{{ t('onion.sub') }}</p>
        <div class="onion-code reveal">
          <CodeBlock :code="middlewareCode" lang="go" :title="t('onion.codeTitle')" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.onion-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 56px;
  align-items: center;
}
.onion-svg {
  width: 100%;
  max-width: 440px;
  margin-inline: auto;
}
.ring {
  fill: rgba(10, 20, 40, 0.35);
  stroke-width: 1.4;
}
.ring-outer {
  stroke: rgba(61, 139, 255, 0.55);
  stroke-dasharray: 5 7;
}
.ring-mid {
  stroke: rgba(124, 108, 255, 0.6);
  stroke-dasharray: 5 7;
}
.ring-core {
  stroke: rgba(70, 230, 224, 0.75);
}
.ring-label {
  fill: var(--blue-ice);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 600;
  text-anchor: middle;
  letter-spacing: 0.06em;
}
.ring-label.mid {
  fill: var(--aurora-violet);
}
.ring-label.core {
  fill: var(--glow-cyan);
  font-family: var(--font-mono);
}
.phase-label {
  font-family: var(--font-mono);
  font-size: 12px;
  text-anchor: middle;
  letter-spacing: 0.14em;
}
.phase-label.req {
  fill: var(--glow-cyan);
}
.phase-label.res {
  fill: var(--aurora-magenta);
}
.axis {
  stroke: rgba(143, 163, 200, 0.18);
  stroke-width: 1;
  stroke-dasharray: 2 6;
}
.dot-req {
  fill: var(--glow-cyan);
}
.dot-res {
  fill: var(--aurora-magenta);
}
.onion-code {
  margin-top: calc(30px * var(--site-space, 1));
}
@media (max-width: 960px) {
  .onion-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 36px;
  }
  .onion-visual {
    order: 2;
  }
}
</style>