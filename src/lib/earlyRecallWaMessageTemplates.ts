
export type EarlyRecallWAEvent =
  | 'EARLY_RECALL_APPROVED'
  | 'EARLY_RECALL_TRAVEL_BOOKED'
  | 'EARLY_RECALL_SCHEDULE_CHANGED'
  | 'EARLY_RECALL_CANCELLED'
  | 'EARLY_RECALL_RETURN_CONFIRMED'
  | 'EARLY_RECALL_OS_GENERATED';

interface EarlyRecallWABaseParams {
  event: EarlyRecallWAEvent;
  employeeName: string;
  employeeCode?: string;
  recallNumber?: string;
}

export interface EarlyRecallApprovedWAParams extends EarlyRecallWABaseParams {
  event: 'EARLY_RECALL_APPROVED';
  plannedReturnDate: string;
  reason: string;
}

export interface EarlyRecallTravelBookedWAParams extends EarlyRecallWABaseParams {
  event: 'EARLY_RECALL_TRAVEL_BOOKED';
  travelDate: string;
  transportation: string;
  origin?: string;
  destination?: string;
  trfNumber?: string;
  remarks?: string;
}

export interface EarlyRecallScheduleChangedWAParams extends EarlyRecallWABaseParams {
  event: 'EARLY_RECALL_SCHEDULE_CHANGED';
  previousTravelDate: string;
  newTravelDate: string;
  remarks?: string;
}

export interface EarlyRecallCancelledWAParams extends EarlyRecallWABaseParams {
  event: 'EARLY_RECALL_CANCELLED';
  cancellationReason: string;
}

export interface EarlyRecallReturnConfirmedWAParams extends EarlyRecallWABaseParams {
  event: 'EARLY_RECALL_RETURN_CONFIRMED';
  actualReturnDate: string;
  remarks?: string;
}

export interface EarlyRecallOSGeneratedWAParams extends EarlyRecallWABaseParams {
  event: 'EARLY_RECALL_OS_GENERATED';
  approvedLeaveDays: number;
  actualLeaveDays: number;
  osGeneratedDays: number;
  cycleNumber: number;
}

export type EarlyRecallWAMessageParams =
  | EarlyRecallApprovedWAParams
  | EarlyRecallTravelBookedWAParams
  | EarlyRecallScheduleChangedWAParams
  | EarlyRecallCancelledWAParams
  | EarlyRecallReturnConfirmedWAParams
  | EarlyRecallOSGeneratedWAParams;

const formatDateID = (value: string): string => {
  if (!value) return '-';

  // Menjaga tanggal YYYY-MM-DD agar tidak bergeser karena timezone browser.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsedDate = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) return value;

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsedDate);
};

const formatDays = (value: number): string => {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${safeValue} hari`;
};

const buildIdentityLines = (params: EarlyRecallWAMessageParams): string[] => {
  const lines: string[] = [];

  if (params.employeeCode?.trim()) {
    lines.push(`Employee ID : ${params.employeeCode.trim()}`);
  }

  if (params.recallNumber?.trim()) {
    lines.push(`Recall No.  : ${params.recallNumber.trim()}`);
  }

  return lines;
};

const buildApprovedMessage = (params: EarlyRecallApprovedWAParams): string[] => [
  '*EARLY RECALL DISETUJUI*',
  '',
  ...buildIdentityLines(params),
  `Rencana kembali : ${formatDateID(params.plannedReturnDate)}`,
  `Alasan           : ${params.reason.trim() || '-'}`,
  '',
  'Permintaan Early Recall telah disetujui. Detail perjalanan akan diinformasikan setelah diproses oleh GA.',
];

const buildTravelBookedMessage = (
  params: EarlyRecallTravelBookedWAParams,
): string[] => {
  const route =
    params.origin?.trim() || params.destination?.trim()
      ? `${params.origin?.trim() || '-'} → ${params.destination?.trim() || '-'}`
      : undefined;

  return [
    '*PERJALANAN EARLY RECALL SUDAH DIATUR*',
    '',
    ...buildIdentityLines(params),
    ...(params.trfNumber?.trim() ? [`TRF No.     : ${params.trfNumber.trim()}`] : []),
    `Tanggal     : ${formatDateID(params.travelDate)}`,
    `Transportasi: ${params.transportation.trim() || '-'}`,
    ...(route ? [`Rute        : ${route}`] : []),
    ...(params.remarks?.trim() ? [`Keterangan  : ${params.remarks.trim()}`] : []),
    '',
    'Silakan periksa tiket atau dokumen perjalanan pada TRF Online.',
  ];
};

const buildScheduleChangedMessage = (
  params: EarlyRecallScheduleChangedWAParams,
): string[] => [
  '*PERUBAHAN JADWAL EARLY RECALL*',
  '',
  ...buildIdentityLines(params),
  `Jadwal sebelumnya : ${formatDateID(params.previousTravelDate)}`,
  `Jadwal baru       : ${formatDateID(params.newTravelDate)}`,
  ...(params.remarks?.trim() ? [`Keterangan        : ${params.remarks.trim()}`] : []),
  '',
  'Silakan periksa kembali detail perjalanan pada TRF Online.',
];

const buildCancelledMessage = (
  params: EarlyRecallCancelledWAParams,
): string[] => [
  '*EARLY RECALL DIBATALKAN*',
  '',
  ...buildIdentityLines(params),
  `Alasan pembatalan: ${params.cancellationReason.trim() || '-'}`,
  '',
  'Perjalanan Early Recall tidak dilanjutkan. Silakan mengikuti jadwal cuti yang telah ditetapkan atau instruksi terbaru dari perusahaan.',
];

const buildReturnConfirmedMessage = (
  params: EarlyRecallReturnConfirmedWAParams,
): string[] => [
  '*KEMBALI KE SITE TERKONFIRMASI*',
  '',
  ...buildIdentityLines(params),
  `Actual Travel In : ${formatDateID(params.actualReturnDate)}`,
  ...(params.remarks?.trim() ? [`Keterangan       : ${params.remarks.trim()}`] : []),
  '',
  'Kepulangan ke site telah dikonfirmasi. Sistem akan memproses sisa cuti yang memenuhi ketentuan Early Recall.',
];

const buildOSGeneratedMessage = (
  params: EarlyRecallOSGeneratedWAParams,
): string[] => [
  '*OS EARLY RECALL TERBENTUK*',
  '',
  ...buildIdentityLines(params),
  `Cuti disetujui : ${formatDays(params.approvedLeaveDays)}`,
  `Cuti digunakan : ${formatDays(params.actualLeaveDays)}`,
  `OS terbentuk   : ${formatDays(params.osGeneratedDays)}`,
  `Cycle          : Cycle ${Math.max(0, params.cycleNumber)}`,
  '',
  'OS tersebut berlaku mengikuti ketentuan maksimum 3 Cycle. Silakan periksa saldo OS pada TRF Online.',
];

export const buildEarlyRecallWaMessage = (
  params: EarlyRecallWAMessageParams,
): string => {
  const header = `Halo ${params.employeeName.trim() || 'Bapak/Ibu'},`;

  let bodyLines: string[];

  switch (params.event) {
    case 'EARLY_RECALL_APPROVED':
      bodyLines = buildApprovedMessage(params);
      break;

    case 'EARLY_RECALL_TRAVEL_BOOKED':
      bodyLines = buildTravelBookedMessage(params);
      break;

    case 'EARLY_RECALL_SCHEDULE_CHANGED':
      bodyLines = buildScheduleChangedMessage(params);
      break;

    case 'EARLY_RECALL_CANCELLED':
      bodyLines = buildCancelledMessage(params);
      break;

    case 'EARLY_RECALL_RETURN_CONFIRMED':
      bodyLines = buildReturnConfirmedMessage(params);
      break;

    case 'EARLY_RECALL_OS_GENERATED':
      bodyLines = buildOSGeneratedMessage(params);
      break;

    default: {
      const exhaustiveCheck: never = params;
      return exhaustiveCheck;
    }
  }

  return [
    header,
    '',
    ...bodyLines,
    '',
    '_Pesan otomatis dari TRF Online MMS._',
  ].join('\n');
};