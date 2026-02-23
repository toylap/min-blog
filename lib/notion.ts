/**
 * Notion API v2025-09-03 클라이언트
 *
 * 구조:
 *   브라우저 → Next.js API Route (서버리스) → Notion API
 *   토큰은 서버리스 함수에서만 사용, 브라우저에 노출되지 않음
 *
 * DB 4개:
 *   1. Posts    → 블로그 글
 *   2. Comments → 댓글/대댓글
 *   3. Likes    → 좋아요
 *   4. Views    → 조회수
 */

import { Client } from '@notionhq/client';
import { NotionAPI } from 'notion-client';
import type { ExtendedRecordMap } from 'notion-types';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
});

// 비공식 API (react-notion-x 렌더링용 recordMap 조회)
const notionAPI = new NotionAPI({
  authToken: process.env.NOTION_TOKEN_V2,
});

const POSTS_DB = process.env.NOTION_DATABASE_ID!;
const COMMENTS_DB = process.env.NOTION_COMMENTS_DB_ID!;
const LIKES_DB = process.env.NOTION_LIKES_DB_ID!;
const VIEWS_DB = process.env.NOTION_VIEWS_DB_ID!;

// ===== TYPES =====

export interface Post {
  id: string;
  title: string;
  slug: string;
  description: string;
  createDt: string;
  tags: string[];
  category: string;
  published: boolean;
}

export interface PostWithContent extends Post {
  recordMap: ExtendedRecordMap;
}

export interface Comment {
  id: string;
  postSlug: string;
  parentId: string | null;
  name: string;
  body: string;
  createDt: string;
  replies?: Comment[];
}

export interface LikeStatus {
  postSlug: string;
  count: number;
  liked: boolean;
}

export interface ViewCount {
  postSlug: string;
  count: number;
}

// ===== DATA SOURCE ID (2025-09-03 API 핵심) =====
// 기존: database_id로 직접 쿼리
// 신규: database_id → data_source_id 조회 → data_source_id로 쿼리

const dsCache: Record<string, string> = {};

async function ds(dbId: string): Promise<string> {
  if (dsCache[dbId]) return dsCache[dbId];

  const res = (await notion.request({
    method: 'get',
    path: `databases/${dbId}`,
  })) as { data_sources: { id: string }[] };

  if (!res.data_sources?.length) {
    throw new Error(`data_sources가 없습니다. DB ID: ${dbId}`);
  }

  dsCache[dbId] = res.data_sources[0].id;
  return dsCache[dbId];
}

async function queryDS(dbId: string, body: Record<string, any>) {
  const id = await ds(dbId);
  return notion.request({
    method: 'post',
    path: `data_sources/${id}/query`,
    body,
  }) as Promise<{ results: any[] }>;
}

async function createPage(dbId: string, properties: Record<string, any>) {
  const id = await ds(dbId);
  return notion.request({
    method: 'post',
    path: 'pages',
    body: {
      parent: { type: 'data_source_id', data_source_id: id },
      properties,
    },
  });
}

// ============================================================
// POSTS
// ============================================================

export async function getAllPosts(): Promise<Post[]> {
  const { results } = await queryDS(POSTS_DB, {
    filter: { property: 'Published', checkbox: { equals: true } },
    sorts: [{ property: 'CreateDt', direction: 'descending' }],
  });
  return results.map(pageToPost);
}

export async function searchPosts(query: string): Promise<Post[]> {
  const { results } = await queryDS(POSTS_DB, {
    filter: {
      and: [
        { property: 'Published', checkbox: { equals: true } },
        { property: 'Title', title: { contains: query } },
      ],
    },
    sorts: [{ property: 'CreateDt', direction: 'descending' }],
  });
  return results.map(pageToPost);
}

export async function getPostBySlug(slug: string): Promise<PostWithContent | null> {
  const { results } = await queryDS(POSTS_DB, {
    filter: {
      and: [
        { property: 'Published', checkbox: { equals: true } },
        { property: 'Slug', rich_text: { equals: slug } },
      ],
    },
  });
  if (!results.length) return null;

  const post = pageToPost(results[0]);
  const recordMap = await notionAPI.getPage(post.id);
  return { ...post, recordMap };
}

function pageToPost(page: any): Post {
  const p = page.properties;
  return {
    id: page.id,
    title: getTitle(p.Title),
    slug: getText(p.Slug) || page.id,
    description: getText(p.Description),
    createDt: p.CreateDt?.date?.start || '',
    tags: p.Tags?.multi_select?.map((t: any) => t.name) || [],
    category: p.Tags?.multi_select?.[0]?.name || '',
    published: true,
  };
}

// ============================================================
// COMMENTS
// ============================================================

export async function getComments(postSlug: string): Promise<Comment[]> {
  const { results } = await queryDS(COMMENTS_DB, {
    filter: { property: 'PostSlug', rich_text: { equals: postSlug } },
    sorts: [{ property: 'CreateDt', direction: 'ascending' }],
  });

  const flat = results.map(pageToComment);
  const top = flat.filter((c) => !c.parentId);
  const replies = flat.filter((c) => c.parentId);

  return top.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parentId === c.id),
  }));
}

export async function createComment(data: {
  postSlug: string;
  parentId?: string;
  name: string;
  body: string;
}): Promise<Comment> {
  const res = await createPage(COMMENTS_DB, {
    Title: { title: [{ text: { content: `${data.name}: ${data.body.slice(0, 30)}` } }] },
    PostSlug: { rich_text: [{ text: { content: data.postSlug } }] },
    ParentId: { rich_text: [{ text: { content: data.parentId || '' } }] },
    Name: { rich_text: [{ text: { content: data.name } }] },
    Body: { rich_text: [{ text: { content: data.body } }] },
    CreateDt: { date: { start: new Date().toISOString() } },
  });
  return pageToComment(res);
}

export async function deleteComment(commentId: string): Promise<boolean> {
  await notion.pages.update({ page_id: commentId, in_trash: true });
  return true;
}

function pageToComment(page: any): Comment {
  const p = page.properties;
  return {
    id: page.id,
    postSlug: getText(p.PostSlug),
    parentId: getText(p.ParentId) || null,
    name: getText(p.Name),
    body: getText(p.Body),
    createDt: p.CreateDt?.date?.start || page.created_time,
  };
}

// ============================================================
// LIKES
// ============================================================

export async function getLikeStatus(postSlug: string, userHash: string): Promise<LikeStatus> {
  const { results } = await queryDS(LIKES_DB, {
    filter: { property: 'PostSlug', rich_text: { equals: postSlug } },
  });
  return {
    postSlug,
    count: results.length,
    liked: results.some((p: any) => getText(p.properties.UserHash) === userHash),
  };
}

export async function toggleLike(postSlug: string, userHash: string): Promise<LikeStatus> {
  // 기존 좋아요 확인
  const { results } = await queryDS(LIKES_DB, {
    filter: {
      and: [
        { property: 'PostSlug', rich_text: { equals: postSlug } },
        { property: 'UserHash', rich_text: { equals: userHash } },
      ],
    },
  });

  if (results.length > 0) {
    // 이미 좋아요 → 취소
    await notion.pages.update({ page_id: results[0].id, in_trash: true });
  } else {
    // 새 좋아요
    await createPage(LIKES_DB, {
      Title: { title: [{ text: { content: `${postSlug}:${userHash}` } }] },
      PostSlug: { rich_text: [{ text: { content: postSlug } }] },
      UserHash: { rich_text: [{ text: { content: userHash } }] },
      CreateDt: { date: { start: new Date().toISOString() } },
    });
  }

  return getLikeStatus(postSlug, userHash);
}

// ============================================================
// VIEWS
// ============================================================

export async function getViewCount(postSlug: string): Promise<ViewCount> {
  const { results } = await queryDS(VIEWS_DB, {
    filter: { property: 'PostSlug', rich_text: { equals: postSlug } },
  });
  return { postSlug, count: results[0]?.properties.Count?.number || 0 };
}

export async function incrementView(postSlug: string): Promise<ViewCount> {
  const { results } = await queryDS(VIEWS_DB, {
    filter: { property: 'PostSlug', rich_text: { equals: postSlug } },
  });

  if (results.length) {
    const current = results[0].properties.Count?.number || 0;
    await notion.pages.update({
      page_id: results[0].id,
      properties: { Count: { number: current + 1 } as any },
    });
    return { postSlug, count: current + 1 };
  }

  await createPage(VIEWS_DB, {
    Title: { title: [{ text: { content: postSlug } }] },
    PostSlug: { rich_text: [{ text: { content: postSlug } }] },
    Count: { number: 1 },
  });
  return { postSlug, count: 1 };
}

// ============================================================
// BLOCKS → HTML 변환
// ============================================================

import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-graphql';

// Notion 언어명 → Prism 언어명 매핑
const LANG_MAP: Record<string, string> = {
  'javascript': 'javascript', 'js': 'javascript',
  'typescript': 'typescript', 'ts': 'typescript',
  'jsx': 'jsx', 'tsx': 'tsx',
  'css': 'css', 'html': 'markup', 'xml': 'markup',
  'json': 'json', 'bash': 'bash', 'shell': 'bash', 'sh': 'bash',
  'python': 'python', 'py': 'python',
  'java': 'java', 'c': 'c', 'c++': 'cpp', 'cpp': 'cpp',
  'c#': 'csharp', 'csharp': 'csharp',
  'go': 'go', 'rust': 'rust', 'sql': 'sql',
  'yaml': 'yaml', 'yml': 'yaml',
  'markdown': 'markdown', 'md': 'markdown',
  'dockerfile': 'docker', 'docker': 'docker',
  'graphql': 'graphql',
  'plain text': 'text', 'text': 'text',
};

function highlight(code: string, lang: string): string {
  const prismLang = LANG_MAP[lang.toLowerCase()] || lang.toLowerCase();
  const grammar = Prism.languages[prismLang];
  if (grammar) {
    return Prism.highlight(code, grammar, prismLang);
  }
  return esc(code);
}

async function getAllBlocks(pageId: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    });
    blocks.push(...res.results);
    hasMore = res.has_more;
    cursor = res.next_cursor ?? undefined;
  }

  // 자식 블록 재귀 조회
  for (const b of blocks) {
    if ((b as any).has_children) {
      (b as any)._children = await getAllBlocks(b.id);
    }
  }
  return blocks;
}

function blocksToHtml(blocks: any[]): string {
  let html = '';
  let list: { tag: string; items: string[] } | null = null;

  for (const b of blocks) {
    const isList = b.type === 'bulleted_list_item' || b.type === 'numbered_list_item';
    const converted = blockToHtml(b);

    if (isList) {
      const tag = b.type === 'bulleted_list_item' ? 'ul' : 'ol';
      if (!list || list.tag !== tag) {
        if (list) html += `<${list.tag}>${list.items.join('')}</${list.tag}>`;
        list = { tag, items: [] };
      }
      list.items.push(converted);
    } else {
      if (list) {
        html += `<${list.tag}>${list.items.join('')}</${list.tag}>`;
        list = null;
      }
      html += converted;
    }
  }
  if (list) html += `<${list.tag}>${list.items.join('')}</${list.tag}>`;
  return html;
}

function blockToHtml(b: any): string {
  const d = b[b.type];
  const ch = b._children ? blocksToHtml(b._children) : '';

  switch (b.type) {
    // ===== Headings =====
    case 'heading_1': {
      const color = d.color && d.color !== 'default' ? ` class="notion-color-${d.color}"` : '';
      return `<h1 id="${slugify(plain(d.rich_text))}"${color}>${rich(d.rich_text)}</h1>`;
    }
    case 'heading_2': {
      const color = d.color && d.color !== 'default' ? ` class="notion-color-${d.color}"` : '';
      return `<h2 id="${slugify(plain(d.rich_text))}"${color}>${rich(d.rich_text)}</h2>`;
    }
    case 'heading_3': {
      const color = d.color && d.color !== 'default' ? ` class="notion-color-${d.color}"` : '';
      return `<h3 id="${slugify(plain(d.rich_text))}"${color}>${rich(d.rich_text)}</h3>`;
    }

    // ===== Text =====
    case 'paragraph': {
      const t = rich(d.rich_text);
      const color = d.color && d.color !== 'default' ? ` class="notion-color-${d.color}"` : '';
      return t ? `<p${color}>${t}${ch}</p>` : '<div class="notion-blank">&nbsp;</div>';
    }

    // ===== Lists (중첩 지원) =====
    case 'bulleted_list_item': {
      const color = d.color && d.color !== 'default' ? ` class="notion-color-${d.color}"` : '';
      // 자식이 리스트면 중첩 ul/ol 생성
      const nested = b._children ? wrapChildList(b._children) : '';
      return `<li${color}>${rich(d.rich_text)}${nested}</li>`;
    }
    case 'numbered_list_item': {
      const color = d.color && d.color !== 'default' ? ` class="notion-color-${d.color}"` : '';
      const nested = b._children ? wrapChildList(b._children) : '';
      return `<li${color}>${rich(d.rich_text)}${nested}</li>`;
    }

    // ===== Code (구문 하이라이트) =====
    case 'code': {
      const lang = d.language || 'plain text';
      const langLabel = lang === 'plain text' ? '' : lang;
      const code = plain(d.rich_text);
      const highlighted = highlight(code, lang);
      const caption = d.caption?.length ? `<div class="code-caption">${rich(d.caption)}</div>` : '';
      return `<div class="code-block">${langLabel ? `<div class="code-header"><span class="code-lang">${esc(langLabel)}</span></div>` : ''}<pre class="language-${LANG_MAP[lang.toLowerCase()] || lang}"><code>${highlighted}</code></pre>${caption}</div>`;
    }

    // ===== Quote & Callout =====
    case 'quote': {
      const color = d.color && d.color !== 'default' ? ` notion-color-${d.color}` : '';
      return `<blockquote class="notion-quote${color}">${rich(d.rich_text)}${ch}</blockquote>`;
    }
    case 'callout': {
      const color = d.color && d.color !== 'default' ? ` notion-color-${d.color}` : '';
      const icon = d.icon?.emoji || d.icon?.external?.url ? `<span class="callout-icon">${d.icon.emoji || `<img src="${d.icon.external.url}" alt="" width="20">`}</span>` : '';
      return `<div class="callout${color}">${icon}<div class="callout-content">${rich(d.rich_text)}${ch}</div></div>`;
    }

    // ===== Toggle =====
    case 'toggle':
      return `<details class="notion-toggle"><summary>${rich(d.rich_text)}</summary><div class="toggle-content">${ch}</div></details>`;

    case 'divider':
      return '<hr class="notion-hr">';

    // ===== Image =====
    case 'image': {
      const url = d.file?.url || d.external?.url || '';
      const cap = d.caption?.length ? rich(d.caption) : '';
      return `<figure class="notion-image"><img src="${url}" alt="${d.caption?.length ? esc(plain(d.caption)) : ''}" loading="lazy">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
    }

    // ===== Bookmark =====
    case 'bookmark': {
      const cap = d.caption?.length ? `<span class="bookmark-desc">${rich(d.caption)}</span>` : '';
      return `<div class="notion-bookmark"><a href="${d.url}" target="_blank" rel="noopener"><span class="bookmark-title">${d.url}</span>${cap}<span class="bookmark-link">${new URL(d.url).hostname}</span></a></div>`;
    }

    // ===== Link Preview =====
    case 'link_preview':
      return `<div class="notion-bookmark"><a href="${d.url}" target="_blank" rel="noopener"><span class="bookmark-title">${d.url}</span><span class="bookmark-link">${(() => { try { return new URL(d.url).hostname; } catch { return d.url; } })()}</span></a></div>`;

    // ===== To-do =====
    case 'to_do': {
      const checked = d.checked ? ' checked' : '';
      return `<div class="notion-todo${d.checked ? ' done' : ''}"><input type="checkbox"${checked} disabled><span>${rich(d.rich_text)}</span></div>`;
    }

    // ===== Table =====
    case 'table': {
      const hasColHeader = d.has_column_header;
      const hasRowHeader = d.has_row_header;
      if (!b._children) return '';
      const rows = b._children.map((row: any, i: number) => {
        const cells = row.table_row?.cells || [];
        const cellTag = (i === 0 && hasColHeader) ? 'th' : 'td';
        return `<tr>${cells.map((c: any[], j: number) => {
          const tag = (j === 0 && hasRowHeader && cellTag !== 'th') ? 'th' : cellTag;
          return `<${tag}>${rich(c)}</${tag}>`;
        }).join('')}</tr>`;
      });
      return `<div class="notion-table-wrap"><table class="notion-table">${rows.join('')}</table></div>`;
    }
    case 'table_row':
      return ''; // table에서 직접 처리

    // ===== Column Layout =====
    case 'column_list':
      return `<div class="notion-columns">${(b._children || []).map((col: any) => blockToHtml(col)).join('')}</div>`;
    case 'column':
      return `<div class="notion-column">${ch}</div>`;

    // ===== Video =====
    case 'video': {
      const url = d.external?.url || d.file?.url || '';
      const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
      if (ytMatch) {
        return `<div class="notion-video"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
      }
      return `<div class="notion-video"><video src="${url}" controls preload="metadata"></video></div>`;
    }

    // ===== Embed =====
    case 'embed':
      return `<div class="notion-embed"><iframe src="${d.url}" loading="lazy" allowfullscreen></iframe></div>`;

    // ===== Equation (블록 수식) =====
    case 'equation':
      return `<div class="notion-equation"><code>${esc(d.expression)}</code></div>`;

    // ===== Synced Block =====
    case 'synced_block':
      return ch;

    // ===== Child Page / Database =====
    case 'child_page':
      return `<div class="notion-child-page">📄 ${esc(d.title)}</div>`;
    case 'child_database':
      return `<div class="notion-child-page">🗃️ ${esc(d.title)}</div>`;

    // ===== File / PDF =====
    case 'file': {
      const fileUrl = d.file?.url || d.external?.url || '';
      const fileName = d.name || d.caption?.length ? plain(d.caption) : fileUrl;
      return `<div class="notion-file"><a href="${fileUrl}" target="_blank" rel="noopener">📎 ${esc(fileName)}</a></div>`;
    }
    case 'pdf': {
      const pdfUrl = d.file?.url || d.external?.url || '';
      return `<div class="notion-embed"><iframe src="${pdfUrl}" loading="lazy"></iframe></div>`;
    }

    // ===== Audio =====
    case 'audio': {
      const audioUrl = d.file?.url || d.external?.url || '';
      return `<audio src="${audioUrl}" controls preload="metadata" style="width:100%"></audio>`;
    }

    // ===== Table of Contents =====
    case 'table_of_contents':
      return ''; // TOC는 별도로 처리

    // ===== Breadcrumb =====
    case 'breadcrumb':
      return '';

    default:
      return '';
  }
}

// 자식 블록에서 리스트 아이템을 중첩 ul/ol로 감싸기
function wrapChildList(children: any[]): string {
  let html = '';
  let list: { tag: string; items: string[] } | null = null;

  for (const c of children) {
    if (c.type === 'bulleted_list_item' || c.type === 'numbered_list_item') {
      const tag = c.type === 'bulleted_list_item' ? 'ul' : 'ol';
      if (!list || list.tag !== tag) {
        if (list) html += `<${list.tag}>${list.items.join('')}</${list.tag}>`;
        list = { tag, items: [] };
      }
      list.items.push(blockToHtml(c));
    } else {
      if (list) {
        html += `<${list.tag}>${list.items.join('')}</${list.tag}>`;
        list = null;
      }
      html += blockToHtml(c);
    }
  }
  if (list) html += `<${list.tag}>${list.items.join('')}</${list.tag}>`;
  return html;
}

// ===== Rich Text =====

function rich(rt: any[]): string {
  if (!rt?.length) return '';
  return rt
    .map((r: any) => {
      // 인라인 수식
      if (r.type === 'equation') {
        return `<code class="notion-inline-equation">${esc(r.equation.expression)}</code>`;
      }
      // 멘션
      if (r.type === 'mention') {
        const m = r.mention;
        if (m.type === 'date') {
          const start = m.date?.start || '';
          const end = m.date?.end ? ` → ${m.date.end}` : '';
          return `<span class="notion-mention-date">📅 ${esc(start + end)}</span>`;
        }
        if (m.type === 'user') {
          return `<span class="notion-mention-user">👤 ${esc(r.plain_text)}</span>`;
        }
        if (m.type === 'page') {
          return `<a class="notion-mention-page" href="#">📄 ${esc(r.plain_text)}</a>`;
        }
        if (m.type === 'link_preview') {
          return `<a href="${m.link_preview.url}" target="_blank" rel="noopener">${esc(r.plain_text)}</a>`;
        }
      }

      let t = esc(r.plain_text);
      const a = r.annotations;
      if (a?.bold) t = `<strong>${t}</strong>`;
      if (a?.italic) t = `<em>${t}</em>`;
      if (a?.code) t = `<code>${t}</code>`;
      if (a?.strikethrough) t = `<del>${t}</del>`;
      if (a?.underline) t = `<u>${t}</u>`;
      if (a?.color && a.color !== 'default')
        t = `<span class="notion-color-${a.color}">${t}</span>`;
      if (r.href)
        t = `<a href="${r.href}" target="_blank" rel="noopener">${t}</a>`;
      return t;
    })
    .join('');
}

function plain(rt: any[]): string {
  return rt?.map((r: any) => r.plain_text).join('') || '';
}

// ===== Property Helpers =====

function getTitle(p: any): string {
  return p?.title?.[0]?.plain_text || 'Untitled';
}

function getText(p: any): string {
  return p?.rich_text?.[0]?.plain_text || '';
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function extractHeadings(html: string) {
  const re = /<h([1-3]) id="([^"]*)">(.*?)<\/h[1-3]>/g;
  const headings: { id: string; text: string; level: number }[] = [];
  let m;
  while ((m = re.exec(html))) {
    headings.push({
      level: +m[1],
      id: m[2],
      text: m[3].replace(/<[^>]*>/g, ''),
    });
  }
  return headings;
}
