<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import HeroSection from '@/components/home/HeroSection.vue'
import FeaturesSection from '@/components/home/FeaturesSection.vue'
import ShowcaseSection from '@/components/home/ShowcaseSection.vue'
import OnionSection from '@/components/home/OnionSection.vue'
import QuickstartSection from '@/components/home/QuickstartSection.vue'
import ExamplesSection from '@/components/home/ExamplesSection.vue'
import DocsCtaSection from '@/components/home/DocsCtaSection.vue'
import GithubSection from '@/components/home/GithubSection.vue'

const store = useAppStore()

onMounted(() => {
  const id = store.pendingAnchor
  if (!id) return
  store.pendingAnchor = ''
  // 等路由自身的 scrollBehavior 落定后再滚，避免被 top:0 覆盖
  nextTick(() =>
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' })
      // 异步高亮替换 DOM 会改变上方高度，落定后再校正一次
      setTimeout(() => {
        const el = document.getElementById(id)
        if (!el) return
        const delta = el.getBoundingClientRect().top - 88
        if (Math.abs(delta) > 4) window.scrollTo({ top: window.scrollY + delta })
      }, 900)
    }, 60),
  )
})
</script>

<template>
  <div class="home">
    <HeroSection />
    <FeaturesSection />
    <ShowcaseSection />
    <OnionSection />
    <QuickstartSection />
    <ExamplesSection />
    <DocsCtaSection />
    <GithubSection />
  </div>
</template>

<style scoped>
.home {
  overflow: clip;
}
</style>