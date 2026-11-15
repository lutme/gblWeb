<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { highlightCode } from '@/lib/markdown'

const props = withDefaults(
  defineProps<{
    code: string
    lang?: string
    title?: string
    head?: boolean
  }>(),
  { lang: 'go', title: '', head: true },
)

const html = ref('')
const copied = ref(false)
let copyTimer = 0

async function render() {
  html.value = await highlightCode(props.code, props.lang)
}

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = props.code
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  window.clearTimeout(copyTimer)
  copyTimer = window.setTimeout(() => (copied.value = false), 1800)
}

onMounted(render)
watch(() => [props.code, props.lang], render)
</script>

<template>
  <div class="code-shell">
    <div v-if="head" class="code-head">
      <span class="dot dot-r"></span>
      <span class="dot dot-y"></span>
      <span class="dot dot-g"></span>
      <span class="code-title">{{ title || lang }}</span>
      <button type="button" class="code-copy" :class="{ copied }" @click="copy">
        <svg v-if="!copied" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
        <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span>{{ copied ? $t('common.copied') : $t('common.copy') }}</span>
      </button>
    </div>
    <div v-if="html" class="code-body" v-html="html"></div>
    <pre v-else class="code-fallback"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.code-body :deep(pre) {
  margin: 0;
  padding: 18px 20px;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.75;
  background: transparent !important;
}
.code-body :deep(code) {
  font-family: var(--font-mono);
}
.code-fallback {
  margin: 0;
  padding: 18px 20px;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-body);
}
@media (max-width: 640px) {
  .code-body :deep(pre),
  .code-fallback {
    font-size: 13px;
    padding: 14px 14px;
  }
}
</style>