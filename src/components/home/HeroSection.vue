<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import gsap from 'gsap'
import OceanBackground from '@/components/effects/OceanBackground.vue'
import CodeBlock from '@/components/CodeBlock.vue'
import { helloCode } from '@/content/samples'

const { t, locale } = useI18n()

const titleLine1 = computed(() => t('hero.titleA'))
const titleLine2 = computed(() =>
  locale.value === 'zh-CN' ? t('hero.titleB') + t('hero.titleC') : `${t('hero.titleB')} ${t('hero.titleC')}`,
)

const heroRef = ref<HTMLElement | null>(null)
const termRef = ref<HTMLElement | null>(null)
const responseVisible = ref(false)

function onPointerMove(e: PointerEvent) {
  const el = termRef.value
  if (!el || window.innerWidth < 960) return
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = (e.clientX - cx) / rect.width
  const dy = (e.clientY - cy) / rect.height
  el.style.transform = `perspective(1100px) rotateY(${dx * 7}deg) rotateX(${-dy * 6}deg)`
}
function onPointerLeave() {
  const el = termRef.value
  if (el) el.style.transform = 'perspective(1100px) rotateY(-4deg) rotateX(2deg)'
}

function goQuickstart() {
  document.getElementById('quickstart')?.scrollIntoView({ behavior: 'smooth' })
}

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduced && heroRef.value) {
    const items = heroRef.value.querySelectorAll('[data-hero-stagger]')
    gsap.fromTo(
      items,
      { opacity: 0, y: 36 },
      { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', delay: 0.15 },
    )
    gsap.fromTo(
      termRef.value,
      { opacity: 0, x: 60, rotateY: -14 },
      { opacity: 1, x: 0, rotateY: -4, duration: 1.1, ease: 'power3.out', delay: 0.5 },
    )
  }
  setTimeout(() => (responseVisible.value = true), reduced ? 200 : 1600)
})
</script>

<template>
  <section ref="heroRef" class="hero" @pointermove="onPointerMove" @pointerleave="onPointerLeave">
    <OceanBackground />

    <div class="container hero-inner">
      <p class="eyebrow" data-hero-stagger>{{ t('hero.eyebrow') }}</p>
      <div class="hero-copy">
        <h1 class="hero-title" data-hero-stagger>
          <span class="title-line1">{{ titleLine1 }}</span>
          <span class="title-line2">{{ titleLine2 }}</span>
        </h1>
        <p class="hero-sub" data-hero-stagger>{{ t('hero.subtitle') }}</p>
        <div class="hero-cta" data-hero-stagger>
          <a href="#quickstart" class="btn btn-primary" @click.prevent="goQuickstart">
            <Icon icon="lucide:rocket" width="17" />{{ t('hero.ctaStart') }}
          </a>
          <router-link to="/docs" class="btn btn-ghost">
            <Icon icon="lucide:book-open" width="17" />{{ t('hero.ctaDocs') }}
          </router-link>
          <a
            class="hero-gh"
            href="https://github.com/gblgo/gbl"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('hero.ctaGithub')"
          >
            <Icon icon="mdi:github" width="21" />
          </a>
        </div>
        <dl class="hero-stats" data-hero-stagger>
          <div class="stat">
            <dt>0</dt>
            <dd>{{ t('hero.stats.deps') }}</dd>
          </div>
          <div class="stat">
            <dt>1</dt>
            <dd>{{ t('hero.stats.engine') }}</dd>
          </div>
          <div class="stat">
            <dt>7</dt>
            <dd>{{ t('hero.stats.verbs') }}</dd>
          </div>
          <div class="stat">
            <dt>MIT</dt>
            <dd>{{ t('hero.stats.license') }}</dd>
          </div>
        </dl>
      </div>

      <div class="hero-visual">
        <div ref="termRef" class="hero-terminal">
          <CodeBlock :code="helloCode" lang="go" :title="t('hero.terminalTitle')" />
          <div class="hero-response" :class="{ shown: responseVisible }">
            <span class="resp-dot"></span>
            <span class="resp-label">{{ t('hero.responseLabel') }}</span>
            <code class="resp-body">hello, gbl</code>
          </div>
        </div>
        <div class="orbit-ring" aria-hidden="true"></div>
      </div>
    </div>

    <a class="scroll-hint" href="#features" aria-hidden="true">
      <span>{{ t('hero.scrollHint') }}</span>
      <Icon icon="lucide:chevrons-down" width="18" />
    </a>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 100svh;
  display: flex;
  align-items: center;
  padding-top: calc(var(--header-h) + 30px);
  padding-bottom: 80px;
  overflow: hidden;
}
.hero-inner {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  gap: 0 56px;
  align-items: center;
}
/* 标语独占一行横跨两列，避免英文长标语在文案列内折行 */
.hero-inner > .eyebrow {
  grid-column: 1 / -1;
  grid-row: 1;
  margin-bottom: 22px;
}
.hero-copy {
  grid-column: 1;
  grid-row: 2;
}
.hero-title {
  margin-top: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.title-line1 {
  font-size: clamp(26px, 3.6vw, 44px);
  font-weight: 500;
  letter-spacing: 0.3em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(168, 208, 255, 0.65);
  text-transform: uppercase;
}
/* CJK 笔画密，空心描边显脏；中文首行改用实心渐隐填充 */
:root[lang='zh-CN'] .title-line1 {
  font-weight: 600;
  -webkit-text-stroke: 0;
  background: linear-gradient(180deg, var(--blue-pale) 12%, rgba(111, 183, 255, 0.32) 92%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.title-line2 {
  font-size: clamp(52px, 7.6vw, 104px);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: 0.04em;
  /* 首尾同色 + 200% 宽：关键帧恰好扫过一个贴图宽度，循环无缝不回退 */
  background: linear-gradient(
    90deg,
    var(--blue-pale) 0%,
    var(--blue-ice) 20%,
    var(--glow-cyan) 42%,
    var(--blue-electric) 62%,
    var(--aurora-violet) 80%,
    var(--blue-pale) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer-x 6s linear infinite;
  filter: drop-shadow(0 0 30px rgba(61, 139, 255, 0.35));
}
.hero-sub {
  margin-top: 26px;
  max-width: 560px;
  font-size: calc(17.5px * var(--site-type, 1));
  color: var(--text-muted);
  line-height: 1.85;
}
.hero-cta {
  margin-top: 36px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.hero-gh {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: var(--text-body);
  border: 1px solid var(--site-border);
  background: rgba(13, 27, 51, 0.55);
  transition: all var(--dur-fast) ease;
}
.hero-gh:hover {
  color: var(--glow-cyan);
  border-color: var(--glow-teal);
  box-shadow: var(--glow-cyan-soft);
  transform: translateY(-2px);
}
.hero-stats {
  margin-top: 46px;
  display: flex;
  gap: 0;
  flex-wrap: wrap;
}
.stat {
  padding: 0 26px;
  border-left: 1px solid var(--site-border);
}
.stat:first-child {
  padding-left: 0;
  border-left: none;
}
.stat dt {
  font-family: var(--font-display);
  font-size: clamp(24px, 2.6vw, 34px);
  font-weight: 700;
  color: var(--text-hi);
  line-height: 1.1;
  text-shadow: 0 0 18px rgba(111, 183, 255, 0.4);
}
.stat dd {
  margin-top: 4px;
  font-size: 12.5px;
  letter-spacing: 0.08em;
  color: var(--text-faint);
}
.hero-visual {
  position: relative;
  grid-column: 2;
  grid-row: 1 / 3;
}
.hero-terminal {
  position: relative;
  z-index: 2;
  transform: perspective(1100px) rotateY(-4deg) rotateX(2deg);
  transition: transform var(--dur-med) cubic-bezier(0.22, 1, 0.36, 1);
  animation: float-y 7s ease-in-out infinite;
}
.hero-terminal::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: var(--radius-md);
  padding: 1px;
  background: linear-gradient(140deg, rgba(111, 183, 255, 0.55), rgba(70, 230, 224, 0.2) 40%, rgba(124, 108, 255, 0.4));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.hero-response {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 12px 18px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(61, 220, 151, 0.3);
  background: rgba(8, 24, 20, 0.6);
  font-family: var(--font-mono);
  font-size: 13px;
  backdrop-filter: blur(8px);
}
.resp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 10px rgba(61, 220, 151, 0.8);
  animation: pulse-glow 1.8s ease-in-out infinite;
  flex-shrink: 0;
}
.resp-label {
  color: var(--success);
}
.resp-body {
  margin-left: auto;
  color: var(--text-hi);
}
.hero-response {
  visibility: hidden;
  opacity: 0;
  transition: opacity var(--dur-med) ease;
}
.hero-response.shown {
  visibility: visible;
  opacity: 1;
}
.orbit-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 560px;
  height: 560px;
  margin: -280px 0 0 -280px;
  border: 1px dashed rgba(61, 139, 255, 0.22);
  border-radius: 50%;
  animation: spin-slow 60s linear infinite;
  pointer-events: none;
}
.orbit-ring::after {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--glow-cyan);
  box-shadow: 0 0 14px rgba(70, 230, 224, 0.9);
}
.scroll-hint {
  position: absolute;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  letter-spacing: 0.26em;
  color: var(--text-faint);
  animation: float-y 2.6s ease-in-out infinite;
}
.scroll-hint:hover {
  color: var(--blue-ice);
}
@media (max-width: 1080px) {
  .hero-inner {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
  .hero-visual {
    max-width: 620px;
    grid-column: 1;
    grid-row: 3;
    margin-top: 48px;
  }
  .orbit-ring {
    display: none;
  }
}
@media (max-width: 640px) {
  .hero {
    padding-top: calc(var(--header-h) + 16px);
    padding-bottom: 96px;
    min-height: auto;
  }
  .hero-sub {
    font-size: 16px;
  }
  .hero-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px 0;
  }
  .stat {
    padding: 0 18px;
  }
  .stat:nth-child(odd) {
    padding-left: 0;
    border-left: none;
  }
  .hero-terminal {
    animation: none;
    transform: none;
  }
  .scroll-hint {
    display: none;
  }
  .title-line1 {
    letter-spacing: 0.18em;
  }
}
</style>