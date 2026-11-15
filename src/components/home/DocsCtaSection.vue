<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { revealOnScroll } from '@/lib/motion'

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)

const cards = [
  { key: 'guide', icon: 'lucide:compass', to: '/docs/getting-started' },
  { key: 'robust', icon: 'lucide:shield-check', to: '/docs/errors' },
  { key: 'ops', icon: 'lucide:server', to: '/docs/logging' },
]

onMounted(() => {
  if (root.value) revealOnScroll(root.value)
})
</script>

<template>
  <section id="docs-cta" ref="root" class="section docs-cta">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">{{ t('docsCta.eyebrow') }}</p>
        <h2 class="section-title">{{ t('docsCta.title') }}</h2>
        <p class="section-sub">{{ t('docsCta.sub') }}</p>
      </div>
      <div class="cta-grid">
        <router-link v-for="c in cards" :key="c.key" :to="c.to" class="cta-card glass-card reveal">
          <span class="cta-icon"><Icon :icon="c.icon" width="22" /></span>
          <h3>{{ t(`docsCta.cards.${c.key}.title`) }}</h3>
          <p>{{ t(`docsCta.cards.${c.key}.desc`) }}</p>
          <span class="cta-arrow"><Icon icon="lucide:arrow-up-right" width="18" /></span>
        </router-link>
      </div>
      <div class="cta-enter reveal">
        <router-link to="/docs" class="btn btn-primary">
          <Icon icon="lucide:book-open" width="17" />{{ t('docsCta.enter') }}
        </router-link>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-head {
  max-width: 720px;
}
.cta-grid {
  margin-top: calc(48px * var(--site-space, 1));
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.cta-card {
  position: relative;
  display: block;
  padding: 28px 24px;
  overflow: hidden;
  transition: transform var(--dur-fast) ease, border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
}
.cta-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(140deg, rgba(61, 139, 255, 0.12), transparent 55%);
  opacity: 0;
  transition: opacity var(--dur-med) ease;
  pointer-events: none;
}
.cta-card:hover {
  transform: translateY(-6px);
  border-color: rgba(70, 230, 224, 0.5);
  box-shadow: 0 18px 44px rgba(2, 6, 18, 0.6), var(--glow-cyan-soft);
}
.cta-card:hover::after {
  opacity: 1;
}
.cta-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: calc(var(--site-radius) * 0.7);
  color: var(--blue-ice);
  background: rgba(30, 86, 176, 0.28);
  border: 1px solid rgba(61, 139, 255, 0.35);
}
.cta-card h3 {
  margin-top: 18px;
  font-size: calc(17.5px * var(--site-type, 1));
}
.cta-card p {
  margin-top: 9px;
  font-size: calc(14px * var(--site-type, 1));
  line-height: 1.7;
  color: var(--text-muted);
}
.cta-arrow {
  position: absolute;
  top: 24px;
  right: 22px;
  color: var(--text-faint);
  transition: all var(--dur-fast) ease;
}
.cta-card:hover .cta-arrow {
  color: var(--glow-cyan);
  transform: translate(3px, -3px);
}
.cta-enter {
  margin-top: 36px;
  text-align: center;
}
@media (max-width: 900px) {
  .cta-grid {
    grid-template-columns: 1fr;
  }
}
</style>