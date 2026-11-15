<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { revealOnScroll } from '@/lib/motion'

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)

const features = [
  { key: 'signature', icon: 'lucide:braces' },
  { key: 'zeroDep', icon: 'lucide:shield-check' },
  { key: 'oneEngine', icon: 'lucide:box' },
  { key: 'onion', icon: 'lucide:layers' },
  { key: 'pooled', icon: 'lucide:zap' },
  { key: 'strictErr', icon: 'lucide:lock' },
  { key: 'graceful', icon: 'lucide:power' },
  { key: 'batteries', icon: 'lucide:battery-charging' },
]

function onCardMove(e: PointerEvent) {
  const card = e.currentTarget as HTMLElement
  const rect = card.getBoundingClientRect()
  card.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  card.style.setProperty('--my', `${e.clientY - rect.top}px`)
}

onMounted(() => {
  if (root.value) revealOnScroll(root.value)
})
</script>

<template>
  <section id="features" ref="root" class="section features">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">{{ t('features.eyebrow') }}</p>
        <h2 class="section-title">{{ t('features.title') }}</h2>
        <p class="section-sub">{{ t('features.sub') }}</p>
      </div>
      <div class="feature-grid">
        <article
          v-for="(f, i) in features"
          :key="f.key"
          class="feature-card glass-card reveal"
          @pointermove="onCardMove"
        >
          <span class="card-index">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="card-icon">
            <Icon :icon="f.icon" width="24" />
          </span>
          <h3>{{ t(`features.items.${f.key}.title`) }}</h3>
          <p>{{ t(`features.items.${f.key}.desc`) }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-head {
  max-width: 720px;
}
.feature-grid {
  margin-top: calc(52px * var(--site-space, 1));
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.feature-card {
  position: relative;
  padding: 28px 24px 26px;
  overflow: hidden;
  transition: transform var(--dur-fast) ease, border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
}
.feature-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(61, 139, 255, 0.16), transparent 65%);
  opacity: 0;
  transition: opacity var(--dur-med) ease;
  pointer-events: none;
}
.feature-card:hover {
  transform: translateY(-6px);
  border-color: rgba(61, 139, 255, 0.5);
  box-shadow: 0 18px 46px rgba(2, 6, 18, 0.6), var(--glow-accent);
}
.feature-card:hover::before {
  opacity: 1;
}
.card-index {
  position: absolute;
  top: 18px;
  right: 20px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--text-faint);
  letter-spacing: 0.1em;
}
.card-icon {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  border-radius: calc(var(--site-radius) * 0.7);
  color: var(--glow-cyan);
  background: linear-gradient(150deg, rgba(30, 86, 176, 0.4), rgba(18, 60, 122, 0.2));
  border: 1px solid rgba(61, 139, 255, 0.35);
  box-shadow: inset 0 0 18px rgba(61, 139, 255, 0.15);
  transition: all var(--dur-fast) ease;
}
.feature-card:hover .card-icon {
  color: var(--text-hi);
  border-color: var(--glow-teal);
  box-shadow: 0 0 22px rgba(70, 230, 224, 0.3), inset 0 0 18px rgba(70, 230, 224, 0.15);
  transform: scale(1.06) rotate(-3deg);
}
.feature-card h3 {
  margin-top: 20px;
  font-size: calc(17.5px * var(--site-type, 1));
  color: var(--text-hi);
}
.feature-card p {
  margin-top: 10px;
  font-size: calc(14.5px * var(--site-type, 1));
  line-height: 1.75;
  color: var(--text-muted);
}
@media (max-width: 1080px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 620px) {
  .feature-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .feature-card {
    padding: 22px 20px;
  }
}
</style>