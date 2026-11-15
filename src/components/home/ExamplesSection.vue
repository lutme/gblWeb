<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import CodeBlock from '@/components/CodeBlock.vue'
import { crudCode, authCode, uploadCode, envelopeCode } from '@/content/samples'
import { revealOnScroll } from '@/lib/motion'

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)

const tabs = [
  { id: 'crud', icon: 'lucide:database', code: crudCode, doc: '/docs/groups', title: 'crud.go' },
  { id: 'auth', icon: 'lucide:key-round', code: authCode, doc: '/docs/values', title: 'auth.go' },
  { id: 'upload', icon: 'lucide:upload-cloud', code: uploadCode, doc: '/docs/uploads', title: 'upload.go' },
  { id: 'envelope', icon: 'lucide:shield-alert', code: envelopeCode, doc: '/docs/errors', title: 'errors.go' },
] as const

const active = ref<(typeof tabs)[number]['id']>('crud')
const current = computed(() => tabs.find((x) => x.id === active.value)!)

onMounted(() => {
  if (root.value) revealOnScroll(root.value)
})
</script>

<template>
  <section id="examples" ref="root" class="section examples">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">{{ t('examples.eyebrow') }}</p>
        <h2 class="section-title">{{ t('examples.title') }}</h2>
        <p class="section-sub">{{ t('examples.sub') }}</p>
        <p class="examples-note">
          <Icon icon="lucide:info" width="15" />{{ t('examples.structNote') }}
        </p>
      </div>

      <div class="examples-panel glass-card reveal">
        <div class="tab-bar" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            role="tab"
            :aria-selected="active === tab.id"
            class="tab-btn"
            :class="{ active: active === tab.id }"
            @click="active = tab.id"
          >
            <Icon :icon="tab.icon" width="16" />
            <span>{{ t(`examples.tabs.${tab.id}`) }}</span>
          </button>
        </div>
        <transition name="tab-fade" mode="out-in">
          <div :key="active" class="tab-body">
            <CodeBlock :code="current.code" lang="go" :title="current.title" />
            <router-link :to="current.doc" class="example-doc-link">
              <Icon icon="lucide:book-open" width="15" />{{ t('examples.docsCta') }}
              <Icon icon="lucide:arrow-right" width="14" />
            </router-link>
          </div>
        </transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-head {
  max-width: 720px;
}
.examples-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 14px;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-muted);
}
.examples-note :deep(svg) {
  flex-shrink: 0;
  margin-top: 4px;
  color: var(--glow-cyan);
}
.examples-panel {
  margin-top: calc(48px * var(--site-space, 1));
  overflow: hidden;
}
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--site-border);
  background: rgba(5, 11, 30, 0.55);
  overflow-x: auto;
}
.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  font-size: 14px;
  white-space: nowrap;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: calc(var(--site-radius) * 0.6);
  transition: all var(--dur-fast) ease;
}
.tab-btn:hover {
  color: var(--text-hi);
  background: rgba(30, 86, 176, 0.14);
}
.tab-btn.active {
  color: var(--blue-ice);
  background: linear-gradient(120deg, rgba(30, 86, 176, 0.32), rgba(18, 60, 122, 0.16));
  border-color: rgba(61, 139, 255, 0.45);
}
.tab-body {
  padding: 22px;
}
.example-doc-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 14px;
  color: var(--blue-ice);
  transition: gap var(--dur-fast) ease, color var(--dur-fast) ease;
}
.example-doc-link:hover {
  color: var(--glow-cyan);
  gap: 11px;
}
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity calc(200ms * var(--site-motion, 1)) ease, transform calc(200ms * var(--site-motion, 1)) ease;
}
.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.tab-fade-leave-to {
  opacity: 0;
}
@media (max-width: 640px) {
  .tab-body {
    padding: 14px;
  }
  .tab-btn {
    padding: 8px 12px;
    font-size: 13px;
  }
}
</style>