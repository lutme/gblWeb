import { createRouter, createWebHashHistory  } from 'vue-router'
import { docSections } from '@/content/docs'

const router = createRouter({
  history: createWebHashHistory (),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/docs',
      redirect: '/docs/introduction',
    },
    {
      path: '/docs/:section',
      name: 'docs',
      component: () => import('@/views/DocsView.vue'),
      props: true,
      beforeEnter: (to) => {
        const slug = String(to.params.section)
        if (!docSections.some((s) => s.slug === slug)) {
          return { name: 'docs-not-found', params: { section: slug } }
        }
        return true
      },
    },
    {
      path: '/docs/:section/404',
      name: 'docs-not-found',
      component: () => import('@/views/DocsView.vue'),
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) {
      // 目标区块在懒加载视图里，导航确认时尚未渲染；等元素出现再滚动
      return new Promise<{ el: string; top: number } | { top: number }>((resolve) => {
        const wait = (tries: number) => {
          if (document.querySelector(to.hash)) setTimeout(() => resolve({ el: to.hash, top: 88 }), 300)
          else if (tries > 0) setTimeout(() => wait(tries - 1), 50)
          else resolve({ top: 0 })
        }
        wait(40)
        // 异步高亮替换 DOM 会改变上方高度，落定后再校正一次
        setTimeout(() => {
          const el = document.querySelector(to.hash)
          if (!el) return
          const delta = el.getBoundingClientRect().top - 88
          if (Math.abs(delta) > 4) window.scrollTo({ top: window.scrollY + delta })
        }, 900)
      })
    }
    if (to.name === from.name && to.name === 'docs') return false
    return { top: 0 }
  },
})

export default router