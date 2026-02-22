'use client';

import dynamic from 'next/dynamic';
import type { ExtendedRecordMap } from 'notion-types';

// react-notion-x 기본 스타일
import 'react-notion-x/styles.css';

// 코드 하이라이팅, 수식 등은 동적 임포트 (번들 사이즈 최적화)
const Code = dynamic(
  () => import('react-notion-x/build/third-party/code').then((m) => m.Code),
  { ssr: false }
);

const Collection = dynamic(
  () => import('react-notion-x/build/third-party/collection').then((m) => m.Collection),
  { ssr: false }
);

const Equation = dynamic(
  () => import('react-notion-x/build/third-party/equation').then((m) => m.Equation),
  { ssr: false }
);

// NotionRenderer도 동적 임포트 (SSR 이슈 방지)
const { NotionRenderer } = require('react-notion-x');

interface NotionPageProps {
  recordMap: ExtendedRecordMap;
}

export default function NotionPage({ recordMap }: NotionPageProps) {
  return (
    <NotionRenderer
      recordMap={recordMap}
      fullPage={false}
      darkMode={true}
      disableHeader={true}
      components={{
        Code,
        Collection,
        Equation,
      }}
    />
  );
}
