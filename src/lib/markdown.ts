import MarkdownIt from 'markdown-it'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import go from 'shiki/langs/go.mjs'
import bash from 'shiki/langs/bash.mjs'
import json from 'shiki/langs/json.mjs'
import ini from 'shiki/langs/ini.mjs'
import http from 'shiki/langs/http.mjs'
import text from 'shiki/langs/markdown.mjs'

export interface TocItem {
  id: string
  text: string
  level: number
}

const gblTheme = {
  name: 'gbl-abyss',
  type: 'dark' as const,
  colors: {
    'editor.background': '#040916',
    'editor.foreground': '#c9d6f2',
  },
  settings: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#5c7099', fontStyle: 'italic' } },
    { scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control'], settings: { foreground: '#6fb7ff' } },
    { scope: ['entity.name.type', 'support.type', 'entity.name.class', 'support.class'], settings: { foreground: '#46e6e0' } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call'], settings: { foreground: '#a8d0ff' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#3ddc97' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: '#f5c86b' } },
    { scope: ['variable', 'variable.parameter', 'variable.other'], settings: { foreground: '#c9d6f2' } },
    { scope: ['entity.name.tag', 'support.constant', 'constant.other'], settings: { foreground: '#b46cff' } },
    { scope: ['keyword.operator', 'punctuation', 'meta.brace'], settings: { foreground: '#8fa3c8' } },
    { scope: ['entity.name.section', 'markup.heading'], settings: { foreground: '#6fb7ff', fontStyle: 'bold' } },
    { scope: ['invalid', 'invalid.illegal'], settings: { foreground: '#ff6b6b' } },
  ],
}

let highlighterPromise: Promise<HighlighterCore> | null = null

export function ensureHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [gblTheme],
      langs: [go, bash, json, ini, http, text],
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighterPromise
}

const langAlias: Record<string, string> = {
  golang: 'go',
  shell: 'bash',
  sh: 'bash',
  console: 'bash',
  shellsession: 'bash',
  jsonc: 'json',
  properties: 'ini',
  plaintext: 'markdown',
  txt: 'markdown',
  '': 'markdown',
}

function normalizeLang(lang: string): string {
  const l = lang.trim().toLowerCase()
  return langAlias[l] ?? l
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function highlightCode(code: string, lang: string): Promise<string> {
  const hl = await ensureHighlighter()
  const l = normalizeLang(lang)
  const loaded = hl.getLoadedLanguages()
  const target = loaded.includes(l) ? l : 'markdown'
  return hl.codeToHtml(code.replace(/\n$/, ''), { lang: target, theme: 'gbl-abyss' })
}

function slugify(text: string, used: Map<string, number>): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()#>!?.:,;'"，。：；！？、]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section'
  const n = used.get(base) ?? 0
  used.set(base, n + 1)
  return n === 0 ? base : `${base}-${n}`
}

function shellWrap(inner: string, lang: string, raw: string): string {
  const title = lang ? lang.toLowerCase() : 'code'
  const encoded = encodeURIComponent(raw)
  // 自托管 mono 子集不含制表符，回退比例字体错列；含制表符的块整块换单一系统等宽字体
  const boxArt = /[─-╿]/.test(raw) ? ' box-art' : ''
  return (
    `<div class="code-shell${boxArt}">` +
    `<div class="code-head">` +
    `<span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span>` +
    `<span class="code-title">${escapeHtml(title)}</span>` +
    `<button type="button" class="code-copy" data-code="${encoded}">` +
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>` +
    `<span class="copy-label">COPY</span></button>` +
    `</div>${inner}</div>`
  )
}

export interface RenderedDoc {
  html: string
  toc: TocItem[]
}

export async function renderDoc(raw: string): Promise<RenderedDoc> {
  const hl = await ensureHighlighter()
  const loaded = hl.getLoadedLanguages()
  const toc: TocItem[] = []
  const used = new Map<string, number>()

  const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]
    const lang = normalizeLang(token.info)
    const target = loaded.includes(lang) ? lang : 'markdown'
    const inner = hl.codeToHtml(token.content.replace(/\n$/, ''), { lang: target, theme: 'gbl-abyss' })
    return shellWrap(inner, token.info.trim() || 'text', token.content)
  }

  md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
    const token = tokens[idx]
    const inline = tokens[idx + 1]
    const textContent = inline?.children?.map((t) => t.content).join('') ?? ''
    const level = Number(token.tag.slice(1))
    if (level >= 1 && level <= 3) {
      const id = slugify(textContent, used)
      token.attrSet('id', id)
      if (level >= 2) toc.push({ id, text: textContent, level })
    }
    return self.renderToken(tokens, idx, options)
  }

  // The page header already renders the section title; drop the document's own h1.
  const html = md.render(raw).replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/, '')
  return { html, toc }
}

export function bindCopyButtons(root: ParentNode, onCopied?: (btn: HTMLElement) => void) {
  root.querySelectorAll<HTMLButtonElement>('.code-copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = decodeURIComponent(btn.dataset.code ?? '')
      try {
        await navigator.clipboard.writeText(code)
      } catch {
        const ta = document.createElement('textarea')
        ta.value = code
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      btn.classList.add('copied')
      const label = btn.querySelector('.copy-label')
      const original = label?.textContent ?? ''
      if (label) label.textContent = 'COPIED ✓'
      onCopied?.(btn)
      setTimeout(() => {
        btn.classList.remove('copied')
        if (label) label.textContent = original
      }, 1800)
    })
  })
}