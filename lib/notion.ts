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
    case 'heading_1':
      return `<h1 id="${slugify(plain(d.rich_text))}">${rich(d.rich_text)}</h1>`;
    case 'heading_2':
      return `<h2 id="${slugify(plain(d.rich_text))}">${rich(d.rich_text)}</h2>`;
    case 'heading_3':
      return `<h3 id="${slugify(plain(d.rich_text))}">${rich(d.rich_text)}</h3>`;
    case 'paragraph': {
      const t = rich(d.rich_text);
      return t ? `<p>${t}</p>` : '<p><br></p>';
    }
    case 'bulleted_list_item':
      return `<li>${rich(d.rich_text)}${ch}</li>`;
    case 'numbered_list_item':
      return `<li>${rich(d.rich_text)}${ch}</li>`;
    case 'code':
      return `<pre><code class="language-${d.language || ''}">${esc(plain(d.rich_text))}</code></pre>`;
    case 'quote':
      return `<blockquote>${rich(d.rich_text)}${ch}</blockquote>`;
    case 'callout':
      return `<div class="callout"><span class="callout-icon">${d.icon?.emoji || '💡'}</span><div>${rich(d.rich_text)}${ch}</div></div>`;
    case 'toggle':
      return `<details><summary>${rich(d.rich_text)}</summary>${ch}</details>`;
    case 'divider':
      return '<hr>';
    case 'image': {
      const url = d.file?.url || d.external?.url || '';
      const cap = d.caption?.length ? plain(d.caption) : '';
      return `<figure><img src="${url}" alt="${cap}" loading="lazy">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
    }
    case 'bookmark':
      return `<a href="${d.url}" class="bookmark" target="_blank" rel="noopener">${d.url}</a>`;
    case 'to_do':
      return `<div class="todo"><input type="checkbox" ${d.checked ? 'checked' : ''} disabled>${rich(d.rich_text)}</div>`;
    case 'table':
      return `<table>${ch}</table>`;
    case 'table_row':
      return `<tr>${(d.cells as any[][]).map((c: any[]) => `<td>${rich(c)}</td>`).join('')}</tr>`;
    case 'video':
      return `<video src="${d.file?.url || d.external?.url || ''}" controls></video>`;
    case 'embed':
      return `<iframe src="${d.url}" loading="lazy" style="width:100%;height:400px;border:none;border-radius:8px"></iframe>`;
    default:
      return '';
  }
}

// ===== Rich Text =====

function rich(rt: any[]): string {
  if (!rt?.length) return '';
  return rt
    .map((r: any) => {
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
