import type { InquiryId } from '@/poe/types';
import { inquiry1 } from './inquiry1';
import { inquiry2 } from './inquiry2';
import { inquiry3 } from './inquiry3';
import { inquiry4 } from './inquiry4';
import type { InquiryDefinition, MeasurementSlot } from './types';

export const INQUIRIES: InquiryDefinition[] = [inquiry1, inquiry2, inquiry3, inquiry4];

export function getInquiry(id: InquiryId | number | string | undefined): InquiryDefinition | undefined {
  const n = typeof id === 'string' ? Number(id) : id;
  return INQUIRIES.find((q) => q.id === n);
}

export function getSlot(def: InquiryDefinition, slotId: string): MeasurementSlot | undefined {
  return def.slots.find((s) => s.id === slotId);
}

export const SENSOR_ROLE_LABEL = { current: '전류 센서', voltage: '전압 센서' } as const;
