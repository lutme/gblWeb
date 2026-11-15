import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { currentLocale, setLocale, type Locale } from '@/i18n'

export const useAppStore = defineStore('app', () => {
  const locale = ref<Locale>(currentLocale())

  watch(locale, (v) => setLocale(v), { immediate: true })

  const mobileNavOpen = ref(false)

  return { locale, mobileNavOpen }
})