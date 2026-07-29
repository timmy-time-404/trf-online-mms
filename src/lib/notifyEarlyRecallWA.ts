import {
  buildEarlyRecallWaMessage,
  type EarlyRecallWAMessageParams,
} from './earlyRecallWaMessageTemplates';
import { sendWhatsAppMessage } from './whatsapp';

export type NotifyEarlyRecallWAParams = EarlyRecallWAMessageParams & {
  employeePhone: string | null | undefined;
};

export const notifyEmployeeEarlyRecallWA = async (
  params: NotifyEarlyRecallWAParams,
): Promise<boolean> => {
  const { employeePhone, ...messageParams } = params;

  if (!employeePhone?.trim()) {
    console.warn(
      `notifyEmployeeEarlyRecallWA: employee ${messageParams.employeeName} tidak memiliki nomor HP. Event ${messageParams.event} tidak dikirim.`,
    );
    return false;
  }

  try {
    const message = buildEarlyRecallWaMessage(messageParams);
    const success = await sendWhatsAppMessage(employeePhone, message);

    if (!success) {
      console.error(
        `notifyEmployeeEarlyRecallWA: gagal mengirim event ${messageParams.event} kepada ${messageParams.employeeName}.`,
      );
      return false;
    }

    console.info(
      `notifyEmployeeEarlyRecallWA: event ${messageParams.event} berhasil dikirim kepada ${messageParams.employeeName}.`,
    );

    return true;
  } catch (error) {
    console.error(
      `notifyEmployeeEarlyRecallWA: error saat mengirim event ${messageParams.event}.`,
      error,
    );
    return false;
  }
};