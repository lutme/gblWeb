<script setup lang="ts">
import { Icon } from '@iconify/vue'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer">
    <div class="footer-glow" aria-hidden="true"></div>
    <div class="container footer-grid">
      <div class="footer-brand">
        <div class="footer-logo">
          <span class="footer-name">GBL</span>
          <span class="footer-lore">GRAND BLUE LORE</span>
        </div>
        <p class="footer-tagline">{{ $t('footer.tagline') }}</p>
      </div>
      <div class="footer-col">
        <h4>{{ $t('footer.nav') }}</h4>
        <router-link to="/">{{ $t('footer.home') }}</router-link>
        <router-link to="/docs/getting-started">{{ $t('footer.quickstart') }}</router-link>
        <router-link to="/docs">{{ $t('footer.docs') }}</router-link>
        <router-link to="/docs/api-reference">{{ $t('footer.apiRef') }}</router-link>
      </div>
      <div class="footer-col">
        <h4>{{ $t('footer.resources') }}</h4>
        <a href="https://github.com/gblgo/gbl" target="_blank" rel="noopener noreferrer">
          <Icon icon="mdi:github" width="15" />{{ $t('footer.github') }}
        </a>
        <a href="https://github.com/gblgo/gbl/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
          <Icon icon="lucide:scale" width="15" />{{ $t('footer.license') }}
        </a>
        <a href="https://github.com/gblgo/gbl/issues" target="_blank" rel="noopener noreferrer">
          <Icon icon="lucide:circle-dot" width="15" />Issues
        </a>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>{{ $t('footer.copyright') }} · {{ year }}</span>
      <span class="footer-built">{{ $t('footer.builtWith') }}</span>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  position: relative;
  margin-top: 40px;
  border-top: 1px solid var(--site-border);
  background: linear-gradient(180deg, rgba(5, 11, 30, 0.4), rgba(3, 7, 19, 0.95));
  overflow: hidden;
}
.footer-glow {
  position: absolute;
  top: -140px;
  left: 50%;
  transform: translateX(-50%);
  width: 720px;
  height: 280px;
  background: radial-gradient(ellipse at center, rgba(30, 86, 176, 0.22), transparent 70%);
  pointer-events: none;
}
.footer-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr;
  gap: 40px;
  padding-block: 56px 36px;
}
.footer-logo {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.footer-name {
  font-family: var(--font-mono);
  font-size: 30px;
  font-weight: 700;
  color: var(--text-hi);
  letter-spacing: 0.05em;
}
.footer-lore {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.34em;
  color: var(--glow-cyan);
}
.footer-tagline {
  margin-top: 10px;
  color: var(--text-muted);
  font-size: 14.5px;
}
.footer-col {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.footer-col h4 {
  font-size: 13.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: 6px;
  font-family: var(--font-mono);
}
.footer-col a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 15px;
  width: fit-content;
  transition: color var(--dur-fast) ease, transform var(--dur-fast) ease;
}
.footer-col a:hover {
  color: var(--glow-cyan);
  transform: translateX(3px);
}
.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-block: 20px;
  border-top: 1px solid rgba(22, 41, 77, 0.6);
  font-size: 13px;
  color: var(--text-faint);
}
@media (max-width: 1024px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
  .footer-brand {
    grid-column: 1 / -1;
  }
}
@media (max-width: 520px) {
  .footer-grid {
    grid-template-columns: 1fr;
    padding-block: 40px 28px;
  }
  .footer-bottom {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>