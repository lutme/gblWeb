<script setup lang="ts">
import HeroSection from '@/components/home/HeroSection.vue'
import FeaturesSection from '@/components/home/FeaturesSection.vue'
import ShowcaseSection from '@/components/home/ShowcaseSection.vue'
import OnionSection from '@/components/home/OnionSection.vue'
import QuickstartSection from '@/components/home/QuickstartSection.vue'
import ExamplesSection from '@/components/home/ExamplesSection.vue'
import DocsCtaSection from '@/components/home/DocsCtaSection.vue'
import GithubSection from '@/components/home/GithubSection.vue'
</script>

<template>
  <div class="home">
    <HeroSection />
    <FeaturesSection />
    <ShowcaseSection />
    <OnionSection />
    <QuickstartSection />
    <ExamplesSection />
    <DocsCtaSection />
    <GithubSection />
  </div>
</template>

<style scoped>
.home {
  overflow: clip;
}
</style>