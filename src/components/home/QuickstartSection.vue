<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import CodeBlock from '@/components/CodeBlock.vue'
import { installCode, helloCode, runCode, iniCode } from '@/content/samples'
import { revealOnScroll } from '@/lib/motion'

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)

const steps = [
  { n: '01', titleKey: 'quickstart.step1', descKey: 'quickstart.step1Desc', code: installCode, lang: 'bash', icon: 'lucide:download' },
  { n: '02', titleKey: 'quickstart.step2', descKey: 'quickstart.step2Desc', code: helloCode, lang: 'go', icon: 'lucide:code-2' },
  { n: '03', titleKey: 'quickstart.step3', descKey: 'quickstart.step3Desc', code: runCode, lang: 'bash', icon: 'lucide:play' },
]

onMounted(() => {
  if (root.value) revealOnScroll(root.value)
})
</script>

<template>
  <section id="quickstart" ref="root" class="section quickstart">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">{{ t('quickstart.eyebrow') }}</p>
        <h2 class="section-title">{{ t('quickstart.title') }}</h2>
        <p class="section-sub">{{ t('quickstart.sub') }}</p>
      </div>

      <div class="steps-grid">
        <article v-for="s in steps" :key="s.n" class="step-card glass-card reveal">
          <header class="step-head">
            <span class="step-n">{{ s.n }}</span>
            <span class="step-icon"><Icon :icon="s.icon" width="18" /></span>
            <h3>{{ t(s.titleKey) }}</h3>
          </header>
          <p class="step-desc">{{ t(s.descKey) }}</p>
          <CodeBlock :code="s.code" :lang="s.lang" :title="s.lang === 'go' ? 'main.go' : 'terminal'" />
        </article>
      </div>

      <div class="ini-row reveal">
        <div class="ini-copy">
          <h3><Icon icon="lucide:settings-2" width="18" />{{ t('quickstart.iniTitle') }}</h3>
          <p>{{ t('quickstart.iniNote') }}</p>
          <router-link to="/docs/configuration" class="btn btn-ghost ini-cta">
            <Icon icon="lucide:arrow-right" width="16" />{{ t('quickstart.docsCta') }}
          </router-link>
        </div>
        <CodeBlock :code="iniCode" lang="ini" title="application.ini" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-head {
  max-width: 720px;
}
.steps-grid {
  margin-top: calc(50px * var(--site-space, 1));
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  align-items: start;
}
.step-card {
  padding: 24px 22px;
  transition: transform var(--dur-fast) ease, border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
}
.step-card:hover {
  transform: translateY(-5px);
  border-color: rgba(61, 139, 255, 0.5);
  box-shadow: 0 16px 42px rgba(2, 6, 18, 0.6), var(--glow-accent);
}
.step-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.step-n {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 700;
  background: linear-gradient(140deg, var(--blue-ice), var(--glow-cyan));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.step-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  color: var(--blue-ice);
  background: rgba(30, 86, 176, 0.25);
  border: 1px solid rgba(61, 139, 255, 0.35);
}
.step-head h3 {
  font-size: calc(17px * var(--site-type, 1));
}
.step-desc {
  margin: 12px 0 16px;
  font-size: calc(14px * var(--site-type, 1));
  color: var(--text-muted);
  min-height: 44px;
}
.ini-row {
  margin-top: 22px;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 24px;
  align-items: center;
  padding: 28px;
  border-radius: var(--radius-md);
  border: 1px dashed rgba(61, 139, 255, 0.35);
  background: rgba(8, 18, 38, 0.5);
}
.ini-copy h3 {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: calc(18px * var(--site-type, 1));
  color: var(--blue-pale);
}
.ini-copy p {
  margin-top: 10px;
  color: var(--text-muted);
  font-size: calc(14.5px * var(--site-type, 1));
}
.ini-cta {
  margin-top: 18px;
}
@media (max-width: 1080px) {
  .steps-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .step-desc {
    min-height: 0;
  }
  .ini-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>