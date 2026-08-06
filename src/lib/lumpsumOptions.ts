export const HR_LUMPSUM_OPTIONS = [
  { value: 75_000, label: 'Rp75.000' },
  { value: 150_000, label: 'Rp150.000' },
  { value: 200_000, label: 'Rp200.000' },
  { value: 275_000, label: 'Rp275.000' },
  { value: 300_000, label: 'Rp300.000' },
  { value: 375_000, label: 'Rp375.000' },
  { value: 400_000, label: 'Rp400.000' },
  { value: 450_000, label: 'Rp450.000' },
  { value: 500_000, label: 'Rp500.000' },
  { value: 575_000, label: 'Rp575.000' },
  { value: 600_000, label: 'Rp600.000' },
  { value: 675_000, label: 'Rp675.000' },
  { value: 700_000, label: 'Rp700.000' },
  { value: 750_000, label: 'Rp750.000' },
  { value: 800_000, label: 'Rp800.000' },
  { value: 875_000, label: 'Rp875.000' },
  { value: 1_000_000, label: 'Rp1.000.000' },
] as const;

export type HRLumpsumAmount =
  (typeof HR_LUMPSUM_OPTIONS)[number]['value'];

export const isHRLumpsumAmount = (
  amount: number,
): amount is HRLumpsumAmount =>
  HR_LUMPSUM_OPTIONS.some(
    option => option.value === amount,
  );

export const formatHRLumpsum = (
  amount: number,
): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
