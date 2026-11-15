<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TocItem } from '@/lib/markdown'

const props = defineProps<{ items: TocItem[] }>()
const { t } = useI18n()
const activeId = ref('')
let observer: IntersectionObserver | null = null

function setupSpy() {
  observer?.disconnect()
  if (!props.items.length) return
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) activeId.value = e.target.id
      }
    },
    { rootMargin: '-90px 0px -72% 0px' },
  )
  props.items.forEach((item) => {
    const el = document.getElementById(item.id)
    if (el) observer?.observe(el)
  })
}

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(() => props.items, setupSpy, { flush: 'post' })
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <aside v-if="items.length" class="docs-toc">
    <p class="toc-title">{{ t('docs.tocTitle') }}</p>
    <a
      v-for="item in items"
      :key="item.id"
      :href="`#${item.id}`"
      class="toc-link"
      :class="{ active: activeId === item.id, sub: item.level === 3 }"
      @click.prevent="jump(item.id)"
    >{{ item.text }}</a>
  </aside>
</template>

<style scoped>
.docs-toc {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-left: 1px solid var(--site-border);
  padding-left: 16px;
}
.toc-title {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: 8px;
}
.toc-link {
  padding: 4px 10px;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--text-muted);
  border-radius: 6px;
  border-left: 2px solid transparent;
  margin-left: -17px;
  padding-left: 25px;
  transition: all var(--dur-fast) ease;
}
.toc-link.sub {
  padding-left: 38px;
  font-size: 13px;
}
.toc-link:hover {
  color: var(--text-hi);
}
.toc-link.active {
  color: var(--blue-ice);
  border-left-color: var(--glow-cyan);
}
</style>