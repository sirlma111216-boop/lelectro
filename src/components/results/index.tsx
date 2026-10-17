import type { ReactElement } from 'react';
import type { InquiryId, InquirySession } from '@/poe/types';
import { Inquiry1Results } from './Inquiry1Results';
import { Inquiry2Results } from './Inquiry2Results';
import { Inquiry3Results } from './Inquiry3Results';
import { Inquiry4Results } from './Inquiry4Results';

/** 탐구별 결과 화면. 거대한 조건문 대신 id → 컴포넌트 표로 고른다. */
export function InquiryResults({ session, readOnly = false }: { session: InquirySession; readOnly?: boolean }) {
  const views: Record<InquiryId, ReactElement> = {
    1: <Inquiry1Results session={session} />,
    2: <Inquiry2Results session={session} readOnly={readOnly} />,
    3: <Inquiry3Results session={session} />,
    4: <Inquiry4Results session={session} />,
  };
  return views[session.inquiryId] ?? null;
}
