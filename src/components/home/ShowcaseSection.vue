<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import CodeBlock from '@/components/CodeBlock.vue'
import { scenarios } from '@/content/samples'
import { revealOnScroll, prefersReducedMotion } from '@/lib/motion'

const { t, tm } = useI18n()
const root = ref<HTMLElement | null>(null)

type ScenarioId = (typeof scenarios)[number]['id']
const active = ref<ScenarioId>('path')
const phase = ref(-1)
const running = ref(false)
let timers: number[] = []

const scenario = computed(() => scenarios.find((s) => s.id === active.value)!)
const steps = computed(() => tm(`showcase.steps.${active.value}`) as string[])
const stageLabels = computed(() => [
  t('showcase.request'),
  t('showcase.binding'),
  t('showcase.handler'),
  t('showcase.response'),
])
const stageIcons = ['lucide:arrow-down-right', 'lucide:puzzle', 'lucide:cpu', 'lucide:arrow-up-right']

const scenarioIcons: Record<ScenarioId, string> = {
  path: 'lucide:route',
  json: 'lucide:braces',
  form: 'lucide:list',
  upload: 'lucide:upload-cloud',
  returns: 'lucide:reply',
}

function clearTimers() {
  timers.forEach((id) => window.clearTimeout(id))
  timers = []
}

function run() {
  clearTimers()
  phase.value = -1
  running.value = true
  const delay = prefersReducedMotion() ? 60 : 720
  steps.value.forEach((_, i) => {
    timers.push(window.setTimeout(() => (phase.value = i), delay * (i + 1)))
  })
  timers.push(
    window.setTimeout(() => {
      phase.value = 4
      running.value = false
    }, delay * (steps.value.length + 1)),
  )
}

function select(id: ScenarioId) {
  if (active.value === id && !running.value) {
    run()
    return
  }
  active.value = id
}

watch(active, run)
onMounted(() => {
  if (root.value) revealOnScroll(root.value)
  run()
})
onBeforeUnmount(clearTimers)
</script>

<template>
  <section id="showcase" ref="root" class="section showcase">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">{{ t('showcase.eyebrow') }}</p>
        <h2 class="section-title">{{ t('showcase.title') }}</h2>
        <p class="section-sub">{{ t('showcase.sub') }}</p>
      </div>

      <div class="showcase-panel glass-card reveal">
        <div class="scenario-rail" role="tablist" :aria-label="t('showcase.title')">
          <span class="demo-badge">
            <Icon icon="lucide:flask-conical" width="13" />{{ t('showcase.demoBadge') }}
          </span>
          <button
            v-for="s in scenarios"
            :key="s.id"
            role="tab"
            :aria-selected="active === s.id"
            class="scenario-btn"
            :class="{ active: active === s.id }"
            @click="select(s.id)"
          >
            <Icon :icon="scenarioIcons[s.id]" width="17" />
            <span>{{ t(`showcase.scenarios.${s.id}`) }}</span>
          </button>
          <button class="run-btn" :disabled="running" @click="run">
            <Icon :icon="running ? 'lucide:loader-2' : 'lucide:play'" width="15" :class="{ spinning: running }" />
            {{ running ? t('showcase.running') : t('showcase.run') }}
          </button>
        </div>

        <div class="showcase-stage">
          <CodeBlock :code="scenario.code" lang="go" title="handler.go" />

          <ol class="pipeline">
            <li
              v-for="(label, i) in stageLabels"
              :key="i"
              class="stage"
              :class="{ live: phase === i, done: phase > i }"
            >
              <span class="stage-node">
                <Icon :icon="phase > i ? 'lucide:check' : stageIcons[i]" width="16" />
              </span>
              <span class="stage-label">{{ label }}</span>
              <span class="stage-step" :class="{ shown: phase >= i }">{{ steps[i] }}</span>
            </li>
          </ol>

          <div class="http-panels">
            <div class="http-panel">
              <span class="http-tag req">REQUEST</span>
              <pre>{{ scenario.request }}</pre>
            </div>
            <div class="http-panel res-state" :class="{ shown: phase >= 4 }">
              <span class="http-tag res">RESPONSE</span>
              <pre>{{ scenario.response }}</pre>
            </div>
            <div class="http-panel res-state waiting" :class="{ shown: phase < 4 }">
              <span class="http-tag res">RESPONSE</span>
              <pre class="waiting-text">{{ running ? t('showcase.running') : '—' }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.showcase-panel {
  margin-top: calc(48px * var(--site-space, 1));
  display: grid;
  grid-template-columns: 230px 1fr;
  overflow: hidden;
}
.scenario-rail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 22px 16px;
  border-right: 1px solid var(--site-border);
  background: rgba(5, 11, 30, 0.5);
}
.demo-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 5px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--truth-gold);
  border: 1px solid rgba(245, 200, 107, 0.35);
  border-radius: 999px;
  background: rgba(245, 200, 107, 0.08);
  width: fit-content;
}
.scenario-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  font-size: 14.5px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: calc(var(--site-radius) * 0.6);
  text-align: left;
  transition: all var(--dur-fast) ease;
}
.scenario-btn:hover {
  color: var(--text-hi);
  background: rgba(30, 86, 176, 0.14);
}
.scenario-btn.active {
  color: var(--blue-ice);
  background: linear-gradient(120deg, rgba(30, 86, 176, 0.3), rgba(18, 60, 122, 0.16));
  border-color: rgba(61, 139, 255, 0.45);
  box-shadow: inset 0 0 16px rgba(61, 139, 255, 0.12);
}
.run-btn {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px;
  font-size: 14px;
  font-weight: 600;
  color: var(--site-on-accent);
  background: linear-gradient(120deg, var(--blue-bright), var(--blue-electric));
  border: none;
  border-radius: calc(var(--site-radius) * 0.6);
  transition: all var(--dur-fast) ease;
}
.run-btn:hover:not(:disabled) {
  box-shadow: var(--glow-accent);
  transform: translateY(-1px);
}
.run-btn:disabled {
  opacity: 0.65;
  cursor: wait;
}
.spinning {
  animation: spin-slow 1s linear infinite;
}
.showcase-stage {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-width: 0;
}
.pipeline {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  position: relative;
}
.pipeline::before {
  content: '';
  position: absolute;
  top: 17px;
  left: 8%;
  right: 8%;
  height: 2px;
  background: linear-gradient(90deg, var(--blue-bright), var(--glow-teal), var(--aurora-violet));
  opacity: 0.35;
}
.stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.stage-node {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--text-faint);
  background: var(--abyss-3);
  border: 1px solid var(--site-border);
  transition: all var(--dur-fast) ease;
  z-index: 1;
}
.stage.live .stage-node {
  color: var(--site-on-accent);
  border-color: var(--glow-cyan);
  background: linear-gradient(140deg, var(--blue-bright), var(--glow-teal));
  box-shadow: 0 0 20px rgba(70, 230, 224, 0.55);
  animation: pulse-glow 1.1s ease-in-out infinite;
}
.stage.done .stage-node {
  color: var(--success);
  border-color: rgba(61, 220, 151, 0.5);
  background: rgba(61, 220, 151, 0.1);
}
.stage-label {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.stage.live .stage-label,
.stage.done .stage-label {
  color: var(--text-hi);
}
.stage-step {
  min-height: 54px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
  color: var(--blue-ice);
  padding: 0 4px;
  visibility: hidden;
}
.stage-step.shown {
  visibility: visible;
}
.http-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.http-panel {
  position: relative;
  border: 1px solid var(--site-border);
  border-radius: var(--radius-sm);
  background: rgba(4, 9, 22, 0.85);
  padding: 30px 16px 14px;
  overflow: hidden;
}
.http-panel pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-body);
  white-space: pre-wrap;
  word-break: break-word;
}
.http-tag {
  position: absolute;
  top: 8px;
  left: 12px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.22em;
  padding: 2px 8px;
  border-radius: 4px;
}
.http-tag.req {
  color: var(--blue-ice);
  background: rgba(61, 139, 255, 0.14);
  border: 1px solid rgba(61, 139, 255, 0.3);
}
.http-tag.res {
  color: var(--success);
  background: rgba(61, 220, 151, 0.1);
  border: 1px solid rgba(61, 220, 151, 0.3);
}
.waiting-text {
  color: var(--text-faint);
}
.http-panel.res-state {
  grid-column: 2;
  grid-row: 1;
  visibility: hidden;
  opacity: 0;
  transition: opacity calc(150ms * var(--site-motion, 1)) ease;
}
.http-panel.res-state.shown {
  visibility: visible;
  opacity: 1;
}
@media (max-width: 960px) {
  .showcase-panel {
    grid-template-columns: 1fr;
  }
  .scenario-rail {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    border-right: none;
    border-bottom: 1px solid var(--site-border);
    padding: 16px;
  }
  .demo-badge {
    margin-bottom: 0;
    margin-right: auto;
  }
  .scenario-btn {
    padding: 8px 11px;
    font-size: 13px;
  }
  .run-btn {
    margin-top: 0;
    padding: 9px 16px;
  }
}
@media (max-width: 640px) {
  .showcase-stage {
    padding: 16px;
  }
  .pipeline {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .pipeline::before {
    top: 0;
    bottom: 0;
    left: 17px;
    right: auto;
    width: 2px;
    height: auto;
    background: linear-gradient(180deg, var(--blue-bright), var(--glow-teal), var(--aurora-violet));
  }
  .stage {
    flex-direction: row;
    text-align: left;
    align-items: flex-start;
  }
  .stage-step {
    min-height: 0;
    flex: 1;
    padding-top: 8px;
  }
  .stage-label {
    display: none;
  }
  .http-panels {
    grid-template-columns: 1fr;
  }
  .http-panel.res-state {
    grid-column: 1;
    grid-row: 2;
  }
}
</style>