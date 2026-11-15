<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { NConfigProvider, darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppFooter from '@/components/layout/AppFooter.vue'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#3d8bff',
    primaryColorHover: '#6fb7ff',
    primaryColorPressed: '#1e56b0',
    primaryColorSuppl: '#46e6e0',
    infoColor: '#46b7e6',
    successColor: '#3ddc97',
    warningColor: '#f5c86b',
    errorColor: '#ff6b6b',
    bodyColor: 'transparent',
    cardColor: '#0d1b33',
    modalColor: '#0d1b33',
    popoverColor: '#0d1b33',
    borderColor: '#16294d',
    dividerColor: '#16294d',
    textColorBase: '#c9d6f2',
    textColor1: '#f2f7ff',
    textColor2: '#c9d6f2',
    textColor3: '#8fa3c8',
    borderRadius: '10px',
    fontFamily:
      "Inter, 'Space Grotesk', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif",
  },
  Dropdown: {
    color: '#0d1b33',
    optionColorHover: 'rgba(61, 139, 255, 0.16)',
    optionColorActive: 'rgba(61, 139, 255, 0.22)',
    optionTextColor: '#c9d6f2',
    optionTextColorHover: '#f2f7ff',
    optionTextColorActive: '#6fb7ff',
    borderRadius: '12px',
  },
  Drawer: {
    color: '#081226',
    headerBorderBottom: '1px solid #16294d',
    bodyPadding: '20px',
  },
  Tooltip: {
    color: '#102342',
    textColor: '#c9d6f2',
    borderRadius: '8px',
  },
}

const scrollProgress = ref(0)
const showBackTop = ref(false)

function onScroll() {
  const doc = document.documentElement
  const max = doc.scrollHeight - window.innerHeight
  scrollProgress.value = max > 0 ? window.scrollY / max : 0
  showBackTop.value = window.scrollY > 640
}

function backTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides" abstract>
    <div class="scroll-progress" :style="{ transform: `scaleX(${scrollProgress})` }" aria-hidden="true"></div>
    <AppHeader />
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <AppFooter />
    <transition name="backtop-fade">
      <button v-show="showBackTop" class="back-top" :aria-label="$t('common.backTop')" @click="backTop">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </transition>
  </n-config-provider>
</template>

<style scoped>
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 1200;
  transform-origin: 0 50%;
  background: linear-gradient(90deg, var(--blue-bright), var(--blue-electric), var(--glow-cyan));
  box-shadow: 0 0 12px rgba(70, 230, 224, 0.55);
}
.app-main {
  min-height: calc(100vh - var(--header-h));
}
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity calc(220ms * var(--site-motion, 1)) ease, transform calc(220ms * var(--site-motion, 1)) ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.page-fade-leave-to {
  opacity: 0;
}
.back-top {
  position: fixed;
  right: 26px;
  bottom: 30px;
  z-index: 1100;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--blue-ice);
  background: rgba(13, 27, 51, 0.85);
  border: 1px solid var(--site-border);
  backdrop-filter: blur(10px);
  transition: all var(--dur-fast) ease;
}
.back-top:hover {
  color: var(--glow-cyan);
  border-color: var(--glow-teal);
  box-shadow: var(--glow-cyan-soft);
  transform: translateY(-3px);
}
.backtop-fade-enter-active,
.backtop-fade-leave-active {
  transition: opacity var(--dur-fast) ease, transform var(--dur-fast) ease;
}
.backtop-fade-enter-from,
.backtop-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>