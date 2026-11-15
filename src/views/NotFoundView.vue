<script setup lang="ts">
import { Icon } from '@iconify/vue'
import AbyssBackground from '@/components/effects/AbyssBackground.vue'
</script>

<template>
  <section class="notfound">
    <AbyssBackground />
    <div class="nf-inner">
      <p class="nf-code">404</p>
      <p class="nf-desc">{{ $t('notFound.desc') }}</p>
      <router-link to="/" class="btn btn-primary">
        <Icon icon="lucide:home" width="16" />{{ $t('notFound.back') }}
      </router-link>
    </div>
  </section>
</template>

<style scoped>
.notfound {
  position: relative;
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 120px 20px 80px;
  overflow: hidden;
}
.nf-inner {
  position: relative;
  z-index: 1;
  text-align: center;
}
.nf-code {
  font-family: var(--font-display);
  font-size: clamp(96px, 18vw, 180px);
  font-weight: 700;
  line-height: 1;
  background: linear-gradient(120deg, var(--blue-ice), var(--glow-cyan), var(--aurora-violet));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 36px rgba(61, 139, 255, 0.4));
}
.nf-desc {
  margin: 18px 0 34px;
  color: var(--text-muted);
  font-size: 17px;
}
</style>