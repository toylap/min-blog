# minsu.dev — Notion 기반 블로그

Notion을 CMS + DB로 사용하는 Next.js 블로그.  
별도 서버 없이 Vercel 서버리스 함수만으로 동작합니다.

---

## 아키텍처

```
[브라우저]
    │
    ├── 정적 페이지 (SSG/ISR) ← Vercel CDN에서 즉시 응답
    │
    └── 동적 기능 (React-Query) ← Vercel 서버리스 함수
            │
            ├── /api/search    → Notion Posts DB 검색
            ├── /api/comments  → Notion Comments DB CRUD
            ├── /api/likes     → Notion Likes DB 토글
            └── /api/views     → Notion Views DB 카운트
                    │
                    └── Notion API (토큰은 서버에서만 사용)
```

**핵심 포인트:**
- 미니PC, EC2, 별도 서버 없음
- Notion API 토큰은 서버리스 함수에서만 사용 → 브라우저에 노출되지 않음
- `git push` → Vercel 자동 빌드/배포 → 운영 비용 0원

---

## 기술 스택

| 구분 | 기술 | 역할 |
|------|------|------|
| 프레임워크 | Next.js 14 + TypeScript | SSG/ISR, API Routes |
| CMS + DB | Notion API (2025-09-03) | 글, 댓글, 좋아요, 조회수 저장 |
| 서버 상태 | React-Query v5 | 캐싱, 낙관적 업데이트, 자동 리페치 |
| 전역 상태 | Zustand v5 | UI 상태 (추후 사용) |
| 배포 | Vercel (무료) | 서버리스 함수 + CDN |

---

## 시작하기

### 1. 프로젝트 클론 & 패키지 설치

```bash
git clone https://github.com/your-username/notion-blog.git
cd notion-blog
npm install
```

### 2. Notion Integration 생성

1. [https://www.notion.so/profile/integrations](https://www.notion.so/profile/integrations) 접속
2. **"+ 새 API 통합"** 클릭
3. 이름 입력 (예: `minsu-blog`), 워크스페이스 선택
4. **Internal Integration Token** 복사 (`ntn_xxx...`)

### 3. Notion DB 4개 생성

Notion에서 **Full Page Database** 4개를 만듭니다.  
각 DB에 아래 속성을 추가하세요.

#### ① Posts DB (블로그 글)

| 속성명 | 타입 | 설명 |
|--------|------|------|
| Title | 제목 (기본) | 글 제목 |
| Slug | 텍스트 | URL 경로 (예: `spring-boot-guide`) |
| Description | 텍스트 | 글 설명 |
| Tags | 다중 선택 | 카테고리/태그 |
| Published | 체크박스 | 체크해야 공개 |
| Date | 날짜 | 작성일 |

#### ② Comments DB (댓글)

| 속성명 | 타입 | 설명 |
|--------|------|------|
| Title | 제목 (기본) | 자동 생성됨 |
| PostSlug | 텍스트 | 어떤 글의 댓글인지 |
| ParentId | 텍스트 | 대댓글이면 부모 댓글 ID |
| Name | 텍스트 | 작성자 이름 |
| Password | 텍스트 | 삭제용 비밀번호 |
| Body | 텍스트 | 댓글 내용 |
| CreatedAt | 날짜 | 작성 시간 |

#### ③ Likes DB (좋아요)

| 속성명 | 타입 | 설명 |
|--------|------|------|
| Title | 제목 (기본) | 자동 생성됨 |
| PostSlug | 텍스트 | 어떤 글의 좋아요인지 |
| UserHash | 텍스트 | 사용자 식별 해시 |
| CreatedAt | 날짜 | 좋아요 시간 |

#### ④ Views DB (조회수)

| 속성명 | 타입 | 설명 |
|--------|------|------|
| Title | 제목 (기본) | 자동 생성됨 |
| PostSlug | 텍스트 | 어떤 글인지 |
| Count | 숫자 | 조회수 |

### 4. DB에 Integration 연결

**4개 DB 모두** 아래 작업 필요:

1. Notion에서 해당 DB 페이지 열기
2. 우측 상단 **`···`** 클릭
3. **"연결 추가(Add Connections)"** → 위에서 만든 Integration 선택

> 이 작업을 하지 않으면 API에서 DB에 접근할 수 없습니다.

### 5. DB ID 복사

각 DB의 URL에서 ID를 추출합니다:

```
https://www.notion.so/워크스페이스/246142fbb1ea80b0a88aea6c8344c13b?v=xxx
                                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                   이 32자리가 DB ID
```

### 6. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 열어서 토큰과 4개 DB ID를 입력:

```env
NOTION_TOKEN=ntn_your_token_here
NOTION_DATABASE_ID=Posts_DB_ID
NOTION_COMMENTS_DB_ID=Comments_DB_ID
NOTION_LIKES_DB_ID=Likes_DB_ID
NOTION_VIEWS_DB_ID=Views_DB_ID

NEXT_PUBLIC_SITE_URL=https://minsu.dev
NEXT_PUBLIC_SITE_NAME=minsu.dev
```

### 7. 로컬 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인

### 8. Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포 (첫 배포 시 프로젝트 연결)
vercel

# 환경변수 설정 (Vercel 대시보드에서도 가능)
vercel env add NOTION_TOKEN
vercel env add NOTION_DATABASE_ID
vercel env add NOTION_COMMENTS_DB_ID
vercel env add NOTION_LIKES_DB_ID
vercel env add NOTION_VIEWS_DB_ID
vercel env add NEXT_PUBLIC_SITE_URL
vercel env add NEXT_PUBLIC_SITE_NAME

# 프로덕션 배포
vercel --prod
```

또는 GitHub 연결 후 `git push`하면 자동 배포됩니다.

---

## 프로젝트 구조

```
notion-blog/
├── app/
│   ├── api/
│   │   ├── search/route.ts      # 실시간 검색 API
│   │   ├── comments/route.ts    # 댓글 CRUD API
│   │   ├── likes/route.ts       # 좋아요 토글 API
│   │   └── views/route.ts       # 조회수 API
│   ├── posts/[slug]/page.tsx    # 글 상세 페이지
│   ├── layout.tsx               # Root Layout (QueryProvider)
│   ├── page.tsx                 # 메인 페이지 (글 목록)
│   ├── not-found.tsx            # 404
│   ├── sitemap.ts               # SEO sitemap
│   └── robots.ts                # SEO robots.txt
├── components/
│   ├── Comments.tsx             # 댓글/대댓글 컴포넌트
│   ├── LikeButton.tsx           # 좋아요 버튼 (낙관적 업데이트)
│   ├── ViewCounter.tsx          # 조회수 (자동 증가)
│   ├── SearchBar.tsx            # 검색 모달 (Ctrl+K)
│   ├── Sidebar.tsx              # 사이드바 네비게이션
│   ├── PostCard.tsx             # 글 카드
│   └── QueryProvider.tsx        # React-Query Provider
├── lib/
│   ├── notion.ts                # Notion API 클라이언트 (서버 전용)
│   └── hooks.ts                 # React-Query 커스텀 훅
├── styles/
│   └── globals.css              # 전체 스타일
├── .env.local.example           # 환경변수 템플릿
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## 데이터 흐름

### 정적 콘텐츠 (글 목록, 글 본문)

```
Notion Posts DB
    ↓ 빌드 타임 / ISR (60초)
Next.js가 HTML 생성
    ↓
Vercel CDN에 캐시
    ↓
브라우저에 즉시 응답 (서버리스 함수 실행 안 함)
```

### 동적 기능 (좋아요, 댓글, 조회수, 검색)

```
브라우저 (React-Query)
    ↓ fetch('/api/likes')
Vercel 서버리스 함수 실행
    ↓ Notion API 호출 (토큰 사용)
Notion DB에서 데이터 읽기/쓰기
    ↓ 응답
서버리스 함수가 JSON 반환
    ↓
React-Query가 캐시 관리 + UI 업데이트
```

### React-Query가 해주는 것

| 기능 | 설명 |
|------|------|
| 캐싱 | 같은 API를 30초 내 재호출하면 캐시에서 즉시 반환 |
| 자동 리페치 | 탭 전환 후 돌아오면 자동으로 최신 데이터 로드 |
| 낙관적 업데이트 | 좋아요 클릭 → UI 즉시 반영 → 서버 응답 후 확정/롤백 |
| 중복 호출 방지 | 같은 쿼리 동시 요청 시 1회만 실행 |
| 로딩/에러 상태 | `isLoading`, `isError` 자동 관리 |

---

## Notion API 2025-09-03 변경 사항

기존 API와 호환되지 않는 구조 변경이 있습니다:

```
# 기존 (2022-06-28)
POST /v1/databases/{database_id}/query

# 신규 (2025-09-03)
GET  /v1/databases/{database_id}        → data_sources 목록 조회
POST /v1/data_sources/{data_source_id}/query  → 실제 쿼리
POST /v1/pages  ← parent에 data_source_id 사용
```

이 프로젝트의 `lib/notion.ts`에서 자동으로 `data_source_id`를 조회하고 캐싱합니다.  
블록 API(`/v1/blocks`)는 변경 없이 동일합니다.

---

## 기능 목록

- [x] Notion에서 글 작성 → 블로그에 자동 반영 (ISR 60초)
- [x] 실시간 검색 (Ctrl+K, 300ms debounce)
- [x] 댓글/대댓글 (이름 + 비밀번호, 비로그인)
- [x] 좋아요 (낙관적 업데이트, IP 기반 중복 방지)
- [x] 조회수 (페이지 진입 시 자동 증가)
- [x] SEO (sitemap.xml, robots.txt, OpenGraph)
- [x] 반응형 디자인 (모바일 사이드바)
- [x] 다크 테마
- [x] 카테고리 필터링

---

## 라이선스

MIT
