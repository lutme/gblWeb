<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NDrawer, NDrawerContent } from 'naive-ui'
import { Icon } from '@iconify/vue'
import DocsSidebar from '@/components/docs/DocsSidebar.vue'
import DocsToc from '@/components/docs/DocsToc.vue'
import { adjacentSections, getDocContent, getSection } from '@/content/docs'
import { bindCopyButtons, renderDoc, type TocItem } from '@/lib/markdown'

const props = defineProps<{ section: string }>()
const route = useRoute()
const { t, locale } = useI18n()

const html = ref('')
const toc = ref<TocItem[]>([])
const loading = ref(true)
const missing = ref(false)
const mobileNav = ref(false)
const contentRef = ref<HTMLElement | null>(null)
let renderToken = 0

const sectionMeta = computed(() => getSection(props.section))
const adjacent = computed(() => adjacentSections(props.section))
const title = computed(() =>
  sectionMeta.value ? sectionMeta.value.title[locale.value as 'zh-CN' | 'en-US'] : t('docs.notFound'),
)
const readingMinutes = computed(() => {
  const raw = getDocContent(props.section, locale.value as 'zh-CN' | 'en-US') ?? ''
  const n = locale.value === 'zh-CN' ? Math.round(raw.length / 450) : Math.round(raw.split(/\s+/).length / 200)
  return Math.max(1, n)
})

async function load() {
  const token = ++renderToken
  loading.value = true
  missing.value = false
  const raw =
    route.name === 'docs-not-found'
      ? undefined
      : getDocContent(props.section, locale.value as 'zh-CN' | 'en-US')
  if (!raw) {
    missing.value = true
    html.value = ''
    toc.value = []
    loading.value = false
    return
  }
  const rendered = await renderDoc(raw)
  if (token !== renderToken) return
  html.value = rendered.html
  toc.value = rendered.toc
  loading.value = false
  document.title = `${title.value} · GBL ${t('docs.title')}`
  await nextTick()
  if (contentRef.value) bindCopyButtons(contentRef.value)
}

function onNavigate() {
  mobileNav.value = false
}

watch(
  () => [props.section, locale.value, route.name],
  () => {
    load()
    if (route.name === 'docs') window.scrollTo({ top: 0 })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  renderToken++
  document.title = t('meta.title')
})
</script>

<template>
  <div class="docs-page">
    <div class="docs-mobile-bar">
      <button class="docs-menu-btn" @click="mobileNav = true">
        <Icon icon="lucide:menu" width="18" />
        <span>{{ title }}</span>
        <Icon icon="lucide:chevron-down" width="14" />
      </button>
    </div>

    <div class="container docs-layout">
      <aside class="docs-aside">
        <DocsSidebar :active="section" @navigate="onNavigate" />
      </aside>

      <article class="docs-main">
        <header class="docs-head">
          <router-link to="/" class="docs-home-link">
            <Icon icon="lucide:arrow-left" width="14" />{{ t('docs.backHome') }}
          </router-link>
          <template v-if="!missing">
            <h1 class="docs-title">{{ title }}</h1>
            <p class="docs-meta">
              <Icon icon="lucide:clock" width="13" />{{ t('docs.readingTime', { n: readingMinutes }) }}
              <span class="meta-sep">·</span>
              <Icon icon="lucide:git-branch" width="13" />gblgo/gbl
            </p>
          </template>
        </header>

        <div v-if="loading" class="docs-loading">
          <span class="loading-orbit"></span>
          <span>{{ t('common.loading') }}</span>
        </div>

        <div v-else-if="missing" class="docs-missing glass-card">
          <Icon icon="lucide:file-question" width="40" />
          <h2>{{ t('docs.notFound') }}</h2>
          <p>{{ t('docs.notFoundDesc') }}</p>
        </div>

        <template v-else>
          <div ref="contentRef" class="doc-body" v-html="html"></div>

          <nav class="docs-pager">
            <router-link v-if="adjacent.prev" :to="`/docs/${adjacent.prev.slug}`" class="pager-card glass-card prev">
              <span class="pager-dir"><Icon icon="lucide:arrow-left" width="13" />{{ t('docs.prev') }}</span>
              <span class="pager-title">{{ adjacent.prev.title[locale as 'zh-CN' | 'en-US'] }}</span>
            </router-link>
            <span v-else></span>
            <router-link v-if="adjacent.next" :to="`/docs/${adjacent.next.slug}`" class="pager-card glass-card next">
              <span class="pager-dir">{{ t('docs.next') }}<Icon icon="lucide:arrow-right" width="13" /></span>
              <span class="pager-title">{{ adjacent.next.title[locale as 'zh-CN' | 'en-US'] }}</span>
            </router-link>
          </nav>
        </template>
      </article>

      <aside class="docs-toc-aside">
        <DocsToc :items="toc" />
      </aside>
    </div>

    <n-drawer v-model:show="mobileNav" placement="left" :width="300">
      <n-drawer-content :title="t('docs.sidebarTitle')" closable>
        <DocsSidebar :active="section" @navigate="onNavigate" />
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
.docs-page {
  padding-top: var(--header-h);
}
.docs-mobile-bar {
  display: none;
  position: sticky;
  top: var(--header-h);
  z-index: 50;
  padding: 10px 4vw;
  background: rgba(5, 11, 30, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--site-border);
}
.docs-menu-btn {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 10px 14px;
  font-size: 14.5px;
  color: var(--text-body);
  background: rgba(13, 27, 51, 0.7);
  border: 1px solid var(--site-border);
  border-radius: 10px;
}
.docs-menu-btn span {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 210px;
  gap: 44px;
  padding-block: 44px 80px;
  align-items: start;
}
.docs-aside {
  position: sticky;
  top: calc(var(--header-h) + 28px);
  max-height: calc(100vh - var(--header-h) - 56px);
  overflow-y: auto;
  padding-right: 8px;
}
.docs-toc-aside {
  position: sticky;
  top: calc(var(--header-h) + 28px);
  max-height: calc(100vh - var(--header-h) - 56px);
  overflow-y: auto;
}
.docs-main {
  min-width: 0;
}
.docs-home-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  color: var(--text-faint);
}
.docs-home-link:hover {
  color: var(--blue-ice);
}
.docs-title {
  margin-top: 14px;
  font-size: clamp(28px, 3.4vw, 38px);
  background: linear-gradient(100deg, var(--text-hi), var(--blue-pale));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.docs-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--text-faint);
}
.meta-sep {
  margin-inline: 4px;
}
.docs-head {
  margin-bottom: 30px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--site-border);
}
.docs-loading {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 80px 0;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14.5px;
}
.loading-orbit {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid rgba(61, 139, 255, 0.25);
  border-top-color: var(--glow-cyan);
  animation: spin-slow 0.9s linear infinite;
}
.docs-missing {
  padding: 60px 30px;
  text-align: center;
  color: var(--text-muted);
}
.docs-missing :deep(svg) {
  margin-inline: auto;
  color: var(--blue-electric);
}
.docs-missing h2 {
  margin-top: 16px;
  font-size: 22px;
}
.docs-missing p {
  margin-top: 10px;
  font-size: 14.5px;
}
.docs-pager {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 56px;
}
.pager-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 18px 20px;
  transition: all var(--dur-fast) ease;
}
.pager-card.next {
  text-align: right;
  align-items: flex-end;
}
.pager-card:hover {
  border-color: rgba(61, 139, 255, 0.55);
  box-shadow: var(--glow-accent);
  transform: translateY(-3px);
}
.pager-dir {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--text-faint);
}
.pager-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 15.5px;
  color: var(--blue-ice);
}
@media (max-width: 1280px) {
  .docs-layout {
    grid-template-columns: 240px minmax(0, 1fr);
  }
  .docs-toc-aside {
    display: none;
  }
}
@media (max-width: 900px) {
  .docs-mobile-bar {
    display: block;
  }
  .docs-layout {
    grid-template-columns: 1fr;
    gap: 0;
    padding-top: 28px;
  }
  .docs-aside {
    display: none;
  }
  .docs-pager {
    grid-template-columns: 1fr;
  }
  .pager-card.next {
    text-align: left;
    align-items: flex-start;
  }
}
</style>