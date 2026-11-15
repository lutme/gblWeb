import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function revealOnScroll(root: HTMLElement, selector = '.reveal') {
  const els = gsap.utils.toArray<HTMLElement>(root.querySelectorAll(selector))
  if (!els.length) return
  if (prefersReducedMotion()) {
    els.forEach((el) => el.classList.add('revealed'))
    return
  }
  ScrollTrigger.batch(els, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.85,
        stagger: 0.1,
        ease: 'power3.out',
        overwrite: true,
      }),
  })
}

export { gsap, ScrollTrigger }