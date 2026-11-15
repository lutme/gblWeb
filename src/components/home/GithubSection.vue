<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { revealOnScroll } from '@/lib/motion'

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)

onMounted(() => {
  if (root.value) revealOnScroll(root.value)
})
</script>

<template>
  <section id="github" ref="root" class="section github-section">
    <div class="container">
      <div class="github-panel reveal">
        <div class="gh-glow" aria-hidden="true"></div>
        <div class="gh-mark" aria-hidden="true">
          <Icon icon="mdi:github" width="64" />
        </div>
        <p class="eyebrow gh-eyebrow">{{ t('github.eyebrow') }}</p>
        <h2 class="gh-title">{{ t('github.title') }}</h2>
        <p class="gh-sub">{{ t('github.sub') }}</p>
        <a
          class="btn btn-primary gh-btn"
          href="https://github.com/gblgo/gbl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon icon="lucide:star" width="17" />{{ t('github.star') }}
        </a>
        <code class="gh-repo">
          <Icon icon="lucide:git-branch" width="14" />{{ t('github.repo') }}
        </code>
        <ul class="gh-points">
          <li><Icon icon="lucide:scale" width="15" />{{ t('github.points.mit') }}</li>
          <li><Icon icon="lucide:package-x" width="15" />{{ t('github.points.zero') }}</li>
          <li><Icon icon="lucide:code-2" width="15" />{{ t('github.points.go') }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.github-panel {
  position: relative;
  text-align: center;
  padding: calc(72px * var(--site-space, 1)) 32px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(61, 139, 255, 0.35);
  background:
    radial-gradient(700px 300px at 50% -80px, rgba(30, 86, 176, 0.35), transparent 70%),
    linear-gradient(165deg, rgba(13, 27, 51, 0.85), rgba(5, 11, 30, 0.95));
  overflow: hidden;
}
.gh-glow {
  position: absolute;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  width: 560px;
  height: 300px;
  background: radial-gradient(ellipse, rgba(70, 230, 224, 0.16), transparent 70%);
  pointer-events: none;
}
.gh-mark {
  display: inline-grid;
  place-items: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  color: var(--text-hi);
  background: rgba(10, 20, 40, 0.8);
  border: 1px solid rgba(111, 183, 255, 0.4);
  box-shadow: 0 0 44px rgba(61, 139, 255, 0.35);
  animation: float-y 6s ease-in-out infinite;
}
.gh-eyebrow {
  margin-top: 26px;
  justify-content: center;
}
.gh-eyebrow::before {
  display: none;
}
.gh-title {
  margin-top: 14px;
  font-size: var(--type-h2);
  background: linear-gradient(100deg, var(--text-hi), var(--blue-pale) 60%, var(--glow-cyan));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.gh-sub {
  margin: 16px auto 0;
  max-width: 560px;
  color: var(--text-muted);
  font-size: calc(15.5px * var(--site-type, 1));
}
.gh-btn {
  margin-top: 32px;
  font-size: calc(16px * var(--site-type, 1));
  padding: 15px 34px;
}
.gh-repo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
  padding: 8px 16px;
  font-family: var(--font-mono);
  font-size: 13.5px;
  color: var(--blue-ice);
  border: 1px dashed rgba(61, 139, 255, 0.4);
  border-radius: 999px;
  background: rgba(8, 18, 38, 0.6);
}
.gh-points {
  list-style: none;
  display: flex;
  justify-content: center;
  gap: 26px;
  flex-wrap: wrap;
  margin-top: 28px;
}
.gh-points li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13.5px;
  color: var(--text-muted);
}
.gh-points li :deep(svg) {
  color: var(--glow-cyan);
}
@media (max-width: 640px) {
  .github-panel {
    padding: 48px 20px;
  }
  .gh-points {
    gap: 14px;
  }
}
</style>