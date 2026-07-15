import { HTMLElement, Node, NodeType, parse } from 'node-html-parser'

export type ArticleDocumentBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'image'; alt: string; source: string }
  | { type: 'rule' }

const BLOCK_TAGS = new Set([
  'article',
  'aside',
  'div',
  'main',
  'section',
  'table',
])

export function parseArticleContent(html: string): ArticleDocumentBlock[] {
  const root = parse(html, {
    lowerCaseTagName: true,
    comment: false,
  })
  const blocks: ArticleDocumentBlock[] = []

  for (const node of root.childNodes) appendNode(node, blocks)

  return blocks.length
    ? blocks
    : [{ type: 'paragraph', text: normalizeText(root.textContent) }]
}

function appendNode(node: Node, blocks: ArticleDocumentBlock[]): void {
  if (node.nodeType === NodeType.TEXT_NODE) {
    appendParagraph(blocks, normalizeText(node.textContent))
    return
  }
  if (!(node instanceof HTMLElement)) return

  const tag = node.tagName.toLowerCase()
  if (['script', 'style', 'noscript'].includes(tag)) return
  if (/^h[1-6]$/.test(tag)) {
    const level = Math.min(Number(tag.slice(1)), 3) as 1 | 2 | 3
    appendTextBlock(blocks, {
      type: 'heading',
      level,
      text: normalizeText(node.textContent),
    })
    return
  }
  if (tag === 'p') {
    appendParagraph(blocks, normalizeText(node.textContent))
    return
  }
  if (tag === 'ul' || tag === 'ol') {
    const items = node
      .querySelectorAll(':scope > li')
      .map((item) => normalizeText(item.textContent))
      .filter(Boolean)
    if (items.length)
      blocks.push({ type: 'list', ordered: tag === 'ol', items })
    return
  }
  if (tag === 'blockquote') {
    appendTextBlock(blocks, {
      type: 'quote',
      text: normalizeText(node.textContent),
    })
    return
  }
  if (tag === 'pre') {
    const code = node.textContent
      .replace(/^<code(?:\s[^>]*)?>/i, '')
      .replace(/<\/code>$/i, '')
    appendTextBlock(blocks, {
      type: 'code',
      text: code.replace(/^\n|\n$/g, ''),
    })
    return
  }
  if (tag === 'img') {
    blocks.push({
      type: 'image',
      alt: normalizeText(node.getAttribute('alt') ?? '') || '文章图片',
      source: node.getAttribute('src')?.trim() ?? '',
    })
    return
  }
  if (tag === 'hr') {
    blocks.push({ type: 'rule' })
    return
  }
  if (tag === 'br') return

  if (BLOCK_TAGS.has(tag)) {
    for (const child of node.childNodes) appendNode(child, blocks)
    return
  }

  appendParagraph(blocks, normalizeText(node.textContent))
}

function appendParagraph(blocks: ArticleDocumentBlock[], text: string): void {
  appendTextBlock(blocks, { type: 'paragraph', text })
}

function appendTextBlock(
  blocks: ArticleDocumentBlock[],
  block: Exclude<ArticleDocumentBlock, { type: 'list' | 'image' | 'rule' }>,
): void {
  if (block.text) blocks.push(block)
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
