<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NDropdown, NDrawer, NDrawerContent } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app'
import type { Locale } from '@/i18n'

const { t, locale } = useI18n()
const store = useAppStore()
const route = useRoute()
const router = useRouter()

const scrolled = ref(false)
const activeAnchor = ref('')

const isHome = computed(() => route.name === 'home')
const isDocs = computed(() => route.name === 'docs' || route.name === 'docs-not-found')

const langOptions = computed(() => [
  { label: '简体中文', key: 'zh-CN' },
  { label: 'English', key: 'en-US' },
])

function onLangSelect(key: string) {
  store.locale = key as Locale
}

const anchorLinks = [
  { id: 'features', key: 'nav.features' },
  { id: 'showcase', key: 'nav.showcase' },
  { id: 'quickstart', key: 'nav.quickstart' },
]

function goAnchor(id: string) {
  store.mobileNavOpen = false
  if (isHome.value) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  } else {
    router.push({ name: 'home', hash: `#${id}` })
  }
}

function goHome() {
  store.mobileNavOpen = false
  if (isHome.value) window.scrollTo({ top: 0, behavior: 'smooth' })
  else router.push({ name: 'home' })
}

// 懒加载视图挂载晚于 header，IntersectionObserver 一次性 observe 会落空；按滚动位置计算当前区块
function updateSpy() {
  if (!isHome.value) {
    activeAnchor.value = ''
    return
  }
  const line = window.scrollY + window.innerHeight * 0.35
  let current = ''
  for (const { id } of anchorLinks) {
    const el = document.getElementById(id)
    if (el && el.getBoundingClientRect().top + window.scrollY <= line) current = id
  }
  activeAnchor.value = current
}

function onScroll() {
  scrolled.value = window.scrollY > 24
  updateSpy()
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})

watch(() => route.fullPath, async () => {
  await nextTick()
  updateSpy()
})
watch(locale, async () => {
  await nextTick()
  updateSpy()
})
</script>

<template>
  <header class="site-header" :class="{ scrolled }">
    <div class="header-inner container">
      <a class="brand" href="/" aria-label="GBL home" @click.prevent="goHome">
        <span class="brand-mark" aria-hidden="true">
          <img src="/logo.png" width="30" height="30" alt="" />
        </span>
        <span class="brand-name">GBL</span>
        <span class="brand-divider" aria-hidden="true"></span>
        <span class="brand-sub">{{ locale === 'zh-CN' ? '伟大蓝色真理' : 'Grand Blue Lore' }}</span>
      </a>

      <nav class="desktop-nav" aria-label="Primary">
        <a class="nav-link" :class="{ active: isHome && !activeAnchor }" href="/" @click.prevent="goHome">{{ t('nav.home') }}</a>
        <a
          v-for="a in anchorLinks"
          :key="a.id"
          class="nav-link"
          :class="{ active: isHome && activeAnchor === a.id }"
          :href="`/#${a.id}`"
          @click.prevent="goAnchor(a.id)"
        >{{ t(a.key) }}</a>
        <router-link class="nav-link" :class="{ active: isDocs }" to="/docs">{{ t('nav.docs') }}</router-link>
      </nav>

      <div class="header-actions">
        <n-dropdown trigger="click" :options="langOptions" :value="store.locale" @select="onLangSelect">
          <button class="lang-btn" :aria-label="t('lang.label')">
            <Icon icon="lucide:globe" width="16" />
            <span>{{ store.locale === 'zh-CN' ? '中文' : 'EN' }}</span>
            <Icon icon="lucide:chevron-down" width="13" />
          </button>
        </n-dropdown>
        <a
          class="github-btn"
          href="https://github.com/gblgo/gbl"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('nav.github')"
        >
          <Icon icon="mdi:github" width="19" />
          <span class="github-text">GitHub</span>
        </a>
        <button class="menu-btn" :aria-label="t('nav.menu')" @click="store.mobileNavOpen = true">
          <Icon icon="lucide:menu" width="22" />
        </button>
      </div>
    </div>
  </header>

  <n-drawer v-model:show="store.mobileNavOpen" placement="right" :width="290">
    <n-drawer-content :title="t('nav.menu')" closable>
      <nav class="mobile-nav" aria-label="Mobile">
        <a class="mobile-link" href="/" @click.prevent="goHome">
          <Icon icon="lucide:home" width="17" />{{ t('nav.home') }}
        </a>
        <a
          v-for="a in anchorLinks"
          :key="a.id"
          class="mobile-link"
          :href="`/#${a.id}`"
          @click.prevent="goAnchor(a.id)"
        >
          <Icon icon="lucide:sparkles" width="17" />{{ t(a.key) }}
        </a>
        <router-link class="mobile-link" to="/docs" @click="store.mobileNavOpen = false">
          <Icon icon="lucide:book-open" width="17" />{{ t('nav.docs') }}
        </router-link>
        <a class="mobile-link" href="https://github.com/gblgo/gbl" target="_blank" rel="noopener noreferrer">
          <Icon icon="mdi:github" width="17" />{{ t('nav.github') }}
        </a>
        <div class="mobile-lang">
          <button
            v-for="opt in langOptions"
            :key="opt.key"
            class="mobile-lang-btn"
            :class="{ active: store.locale === opt.key }"
            @click="onLangSelect(opt.key)"
          >{{ opt.label }}</button>
        </div>
      </nav>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  height: var(--header-h);
  transition: background var(--dur-fast) ease, border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
  border-bottom: 1px solid transparent;
}
.site-header.scrolled {
  background: rgba(5, 11, 30, 0.82);
  backdrop-filter: blur(16px) saturate(1.3);
  border-bottom-color: rgba(22, 41, 77, 0.8);
  box-shadow: 0 8px 32px rgba(2, 6, 18, 0.5);
}
.header-inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 28px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  flex-shrink: 0;
}
.brand-mark {
  filter: drop-shadow(0 0 10px rgba(61, 139, 255, 0.4));
}
.brand-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 21px;
  letter-spacing: 0.1em;
  background: linear-gradient(115deg, var(--blue-pale) 10%, var(--blue-ice) 55%, var(--glow-cyan) 110%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.brand-divider {
  width: 1px;
  height: 16px;
  background: linear-gradient(
    180deg,
    transparent,
    rgba(111, 183, 255, 0.7) 30%,
    rgba(70, 230, 224, 0.7) 70%,
    transparent
  );
}
.brand-sub {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.24em;
  color: var(--text-muted);
  white-space: nowrap;
}
:root[lang='zh-CN'] .brand-sub {
  font-size: 15px;
}
@media (max-width: 1100px) {
  .brand-divider,
  .brand-sub {
    display: none;
  }
}
.desktop-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.nav-link {
  position: relative;
  padding: 8px 13px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-muted);
  border-radius: 8px;
  transition: color var(--dur-fast) ease, background var(--dur-fast) ease;
}
.nav-link:hover {
  color: var(--text-hi);
  background: rgba(30, 86, 176, 0.14);
}
.nav-link.active {
  color: var(--blue-ice);
}
.nav-link.active::after {
  content: '';
  position: absolute;
  left: 13px;
  right: 13px;
  bottom: 2px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--blue-electric), var(--glow-cyan));
  box-shadow: 0 0 8px rgba(70, 230, 224, 0.6);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  font-size: 13.5px;
  color: var(--text-muted);
  background: rgba(13, 27, 51, 0.6);
  border: 1px solid var(--site-border);
  border-radius: 9px;
  transition: all var(--dur-fast) ease;
}
.lang-btn:hover {
  color: var(--blue-ice);
  border-color: var(--blue-electric);
}
.github-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-hi);
  background: linear-gradient(120deg, rgba(30, 86, 176, 0.5), rgba(18, 60, 122, 0.5));
  border: 1px solid rgba(61, 139, 255, 0.4);
  border-radius: 9px;
  transition: all var(--dur-fast) ease;
}
.github-btn:hover {
  color: var(--site-on-accent);
  border-color: var(--blue-electric);
  box-shadow: var(--glow-accent);
  transform: translateY(-1px);
}
.menu-btn {
  display: none;
  padding: 7px;
  color: var(--text-body);
  background: transparent;
  border: 1px solid var(--site-border);
  border-radius: 9px;
}
.mobile-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mobile-link {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 14px;
  color: var(--text-body);
  border-radius: 10px;
  font-size: 15.5px;
  transition: background var(--dur-fast) ease, color var(--dur-fast) ease;
}
.mobile-link:hover {
  background: rgba(30, 86, 176, 0.16);
  color: var(--text-hi);
}
.mobile-lang {
  display: flex;
  gap: 8px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--site-border);
}
.mobile-lang-btn {
  flex: 1;
  padding: 10px;
  font-size: 14px;
  color: var(--text-muted);
  background: rgba(13, 27, 51, 0.6);
  border: 1px solid var(--site-border);
  border-radius: 9px;
  transition: all var(--dur-fast) ease;
}
.mobile-lang-btn.active {
  color: var(--blue-ice);
  border-color: var(--blue-electric);
  background: rgba(30, 86, 176, 0.25);
}
@media (max-width: 960px) {
  .desktop-nav {
    display: none;
  }
  .menu-btn {
    display: inline-flex;
  }
  .github-text {
    display: none;
  }
  .github-btn {
    padding: 7px 10px;
  }
  .header-inner {
    gap: 12px;
  }
  .header-actions {
    margin-left: auto;
  }
}
</style>