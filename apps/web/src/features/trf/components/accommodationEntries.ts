import type { Accommodation } from '@/types';

/** Accommodation row in the TRF form; `_id` is a client-only React key. */
export interface AccommodationEntry extends Accommodation {
  _id: string;
}

const generateAccommodationId = () =>
  `accommodation-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;


export const createEmptyAccommodationEntry =
  (): AccommodationEntry => ({
    _id: generateAccommodationId(),
    hotelName: '',
    checkInDate: '',
    checkOutDate: '',
    remarks: '',
  });
