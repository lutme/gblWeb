export type DocGroup = 'start' | 'core' | 'robust' | 'ops' | 'ref'
export type DocLocale = 'zh-CN' | 'en-US'

export interface DocSection {
  slug: string
  group: DocGroup
  title: Record<DocLocale, string>
}

export const docSections: DocSection[] = [
  { slug: 'introduction', group: 'start', title: { 'zh-CN': '简介', 'en-US': 'Introduction' } },
  { slug: 'getting-started', group: 'start', title: { 'zh-CN': '快速上手', 'en-US': 'Getting Started' } },
  { slug: 'handlers', group: 'core', title: { 'zh-CN': 'Handler 与参数装配', 'en-US': 'Handlers & Binding' } },
  { slug: 'routing', group: 'core', title: { 'zh-CN': '路由', 'en-US': 'Routing' } },
  { slug: 'groups', group: 'core', title: { 'zh-CN': '路由分组', 'en-US': 'Route Groups' } },
  { slug: 'middleware', group: 'core', title: { 'zh-CN': '中间件', 'en-US': 'Middleware' } },
  { slug: 'context', group: 'core', title: { 'zh-CN': 'Context 详解', 'en-US': 'Context Reference' } },
  { slug: 'values', group: 'core', title: { 'zh-CN': '请求级取值', 'en-US': 'Request-scoped Values' } },
  { slug: 'errors', group: 'robust', title: { 'zh-CN': '错误与 panic', 'en-US': 'Errors & Panics' } },
  { slug: 'validation', group: 'robust', title: { 'zh-CN': '参数校验', 'en-US': 'Validation' } },
  { slug: 'uploads', group: 'robust', title: { 'zh-CN': '文件上传', 'en-US': 'File Uploads' } },
  { slug: 'logging', group: 'ops', title: { 'zh-CN': '日志', 'en-US': 'Logging' } },
  { slug: 'cors', group: 'ops', title: { 'zh-CN': '跨域 CORS', 'en-US': 'CORS' } },
  { slug: 'compression', group: 'ops', title: { 'zh-CN': '响应压缩', 'en-US': 'Compression' } },
  { slug: 'configuration', group: 'ops', title: { 'zh-CN': '配置', 'en-US': 'Configuration' } },
  { slug: 'lifecycle', group: 'ops', title: { 'zh-CN': '服务生命周期', 'en-US': 'Server Lifecycle' } },
  { slug: 'deployment', group: 'ops', title: { 'zh-CN': '部署与构建', 'en-US': 'Deployment & Builds' } },
  { slug: 'performance', group: 'ops', title: { 'zh-CN': '性能', 'en-US': 'Performance' } },
  { slug: 'api-reference', group: 'ref', title: { 'zh-CN': 'API 总览', 'en-US': 'API Reference' } },
]

export const docGroupOrder: DocGroup[] = ['start', 'core', 'robust', 'ops', 'ref']

const zhModules = import.meta.glob('./zh/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const enModules = import.meta.glob('./en/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export function getSection(slug: string): DocSection | undefined {
  return docSections.find((s) => s.slug === slug)
}

export function getDocContent(slug: string, locale: DocLocale): string | undefined {
  const modules = locale === 'zh-CN' ? zhModules : enModules
  return modules[`./${locale === 'zh-CN' ? 'zh' : 'en'}/${slug}.md`]
}

export function adjacentSections(slug: string): { prev?: DocSection; next?: DocSection } {
  const i = docSections.findIndex((s) => s.slug === slug)
  if (i < 0) return {}
  return {
    prev: i > 0 ? docSections[i - 1] : undefined,
    next: i < docSections.length - 1 ? docSections[i + 1] : undefined,
  }
}

export function sectionsByGroup(group: DocGroup): DocSection[] {
  return docSections.filter((s) => s.group === group)
}