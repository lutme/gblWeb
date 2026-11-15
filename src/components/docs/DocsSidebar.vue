<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { docGroupOrder, sectionsByGroup, type DocGroup } from '@/content/docs'

defineProps<{ active: string }>()
const emit = defineEmits<{ navigate: [slug: string] }>()

const { t, locale } = useI18n()

const groupIcons: Record<DocGroup, string> = {
  start: 'lucide:rocket',
  core: 'lucide:cpu',
  robust: 'lucide:shield-check',
  ops: 'lucide:server',
  ref: 'lucide:list-tree',
}

function onNavigate(slug: string) {
  emit('navigate', slug)
}
</script>

<template>
  <nav class="docs-sidebar" aria-label="Docs">
    <p class="sidebar-title">
      <Icon icon="lucide:book-marked" width="16" />{{ t('docs.sidebarTitle') }}
    </p>
    <div v-for="group in docGroupOrder" :key="group" class="sidebar-group">
      <p class="group-label">
        <Icon :icon="groupIcons[group]" width="15" />{{ t(`docs.groups.${group}`) }}
      </p>
      <router-link
        v-for="s in sectionsByGroup(group)"
        :key="s.slug"
        :to="`/docs/${s.slug}`"
        class="sidebar-link"
        :class="{ active: active === s.slug }"
        @click="onNavigate(s.slug)"
      >
        {{ s.title[locale as 'zh-CN' | 'en-US'] }}
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.docs-sidebar {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.sidebar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--text-hi);
  letter-spacing: 0.03em;
}
.sidebar-title :deep(svg) {
  color: var(--glow-cyan);
}
.sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.group-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.sidebar-link {
  position: relative;
  padding: 7px 12px;
  font-size: 14.5px;
  color: var(--text-muted);
  border-radius: 8px;
  border-left: 2px solid transparent;
  transition: all var(--dur-fast) ease;
}
.sidebar-link:hover {
  color: var(--text-hi);
  background: rgba(30, 86, 176, 0.14);
}
.sidebar-link.active {
  color: var(--blue-ice);
  background: linear-gradient(90deg, rgba(30, 86, 176, 0.28), transparent);
  border-left-color: var(--glow-cyan);
}
</style>