import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { TRF, TravelPurposeEntry, Accommodation, TRFStatus } from '@/types';
import { TRAVEL_PURPOSE_OPTIONS, getPurposeLabel } from '@/constants/travelPurposeOptions';

// ─────────────────────────────────────────────────────────────
// 1. HELPERS
// ─────────────────────────────────────────────────────────────
const fmtDate = (d?: string): string => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const numDays = (start?: string, end?: string): string => {
  if (!start || !end) return '-';
  const diff = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  return `${diff}`;
};

/**
 * Parse travelPurpose: bisa berupa:
 * - string lama: "TRAINING"
 * - JSON array baru: '["FIELD_BREAK","TRAINING"]'
 * - array langsung: ["FIELD_BREAK","TRAINING"]
 * Selalu return string[]
 */
const parsePurposes = (raw: string | string[] | undefined): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    return raw ? [raw] : [];
  } catch {
    return raw ? [raw] : [];
  }
};

// ─────────────────────────────────────────────────────────────
// 2. HTML TEMPLATE
// ─────────────────────────────────────────────────────────────
const buildHTML = (trf: TRF): string => {
  const MIN_PURPOSE_ROWS = 1;
  const MIN_ACCOM_ROWS   = 1;
  const MIN_ARR_ROWS     = 2;

  // ── Resolve purpose entries ──────────────────────────────────
  const rawPurposeEntries: TravelPurposeEntry[] =
    Array.isArray((trf as any).purposeEntries) && (trf as any).purposeEntries.length > 0
      ? (trf as any).purposeEntries
      : [{
          id            : 'legacy',
          travelPurpose : trf.travelPurpose ?? '',
          startDate     : trf.startDate     ?? '',
          endDate       : trf.endDate       ?? '',
          purposeRemarks: trf.purposeRemarks ?? '',
        }];

  const purposeRows = rawPurposeEntries.map(p => {
    const keys   = parsePurposes(p.travelPurpose);
    const labels = keys.map(k => getPurposeLabel(k)).join(', ');
    return {
      start  : fmtDate(p.startDate),
      end    : fmtDate(p.endDate),
      days   : numDays(p.startDate, p.endDate),
      purpose: labels || '-',
    };
  });
  while (purposeRows.length < MIN_PURPOSE_ROWS)
    purposeRows.push({ start:'', end:'', days:'', purpose:'' });

  // ── Accommodation rows ───────────────────────────────────────
  const rawAccomEntries: Accommodation[] =
    Array.isArray((trf as any).accommodations) && (trf as any).accommodations.length > 0
      ? (trf as any).accommodations
      : trf.accommodation
      ? [trf.accommodation]
      : [];

  const accomRows = rawAccomEntries.map(a => ({
    type    : a.hotelName    ?? 'By Site Service',
    checkIn : fmtDate(a.checkInDate),
    checkOut: fmtDate(a.checkOutDate),
    remarks : a.remarks      ?? '',
  }));
  while (accomRows.length < MIN_ACCOM_ROWS)
    accomRows.push({ type:'', checkIn:'', checkOut:'', remarks:'' });

  // ── Travel arrangement rows ──────────────────────────────────
  // Menambahkan properti 'type' (Travel In / Travel Out) sesuai permintaan
  const arrRows = (trf.travelArrangements ?? []).map(a => {
    let typeLabel = '-';
    if (a.travelType === 'TRAVEL_IN') typeLabel = 'Travel In';
    else if (a.travelType === 'TRAVEL_OUT') typeLabel = 'Travel Out';
    else if (a.travelType) typeLabel = a.travelType.replace(/_/g, ' ');

    return {
      date     : fmtDate(a.travelDate),
      type     : typeLabel,
      from     : a.fromLocation ?? '-',
      to       : a.toLocation   ?? '-',
      transport: (a.transportation ?? '-').replace(/_/g, ' '),
      remarks  : a.remarks ?? '',
    };
  });
  while (arrRows.length < MIN_ARR_ROWS)
    arrRows.push({ date:'', type:'', from:'', to:'', transport:'', remarks:'' });

  // ── Approval ─────────────────────────────────────────────────
const statusOrder: TRFStatus[] = [
    'SUBMITTED',
    'ADMIN_DEPT_VERIFIED',
    'PENDING_APPROVAL',
    'HOD_APPROVED',
    'HR_APPROVED',
    'PM_APPROVED',
    'GA_PROCESSED',
  ];
  const currentIdx = statusOrder.indexOf(trf.status);

  const hodApproved = currentIdx >= statusOrder.indexOf('HOD_APPROVED');
  const hrApproved  = currentIdx >= statusOrder.indexOf('HR_APPROVED');
  const pmApproved  = currentIdx >= statusOrder.indexOf('PM_APPROVED');
  const gaProcessed = trf.status === 'GA_PROCESSED';

const buildApprovedStamp = (date?: string) => `
  <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%) rotate(-15deg);
    color:green;font-weight:bold;border:2px solid green;padding:2px 5px;border-radius:4px;
    opacity:0.7;font-size:10px;white-space:nowrap;text-align:center;line-height:1.3;">
    APPROVED
    ${date ? `<div style="font-size:7px;font-weight:normal;">${fmtDate(date)}</div>` : ''}
  </div>`;

const buildProcessedStamp = (date?: string) => `
  <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%) rotate(-15deg);
    color:blue;font-weight:bold;border:2px solid blue;padding:2px 5px;border-radius:4px;
    opacity:0.7;font-size:10px;white-space:nowrap;text-align:center;line-height:1.3;">
    PROCESSED
    ${date ? `<div style="font-size:7px;font-weight:normal;">${fmtDate(date)}</div>` : ''}
  </div>`;
  
  return `
    <div id="pdf-export-container" style="
      width:794px; padding:30px; font-family:Arial,sans-serif;
      font-size:11px; color:#000; background-color:#fff;
      line-height:1.4; box-sizing:border-box;">

      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;
        border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:15px;">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:bold;">TRAVEL REQUEST FORM</h2>
          <p style="margin:0;font-style:italic;color:#555;">Formulir Permohonan Perjalanan</p>
          <p style="margin:5px 0 0 0;font-weight:bold;font-size:12px;">
            TRF No: ${trf.trfNumber ?? '-'}
          </p>
        </div>
        <div style="text-align:right;">
          <img src="/LogoMerdeka.png"
            style="height:45px;width:auto;max-width:150px;object-fit:contain;"
            alt="Logo Merdeka Mining Service" />
        </div>
      </div>

      <style>
        .trf-table{width:100%;border-collapse:collapse;margin-bottom:12px;}
        .trf-table th,.trf-table td{border:1px solid #000;padding:5px 6px;vertical-align:top;}
        .trf-table th{background-color:#f2f2f2;font-weight:bold;text-align:left;}
        .sub-label{font-size:9px;font-style:italic;color:#555;display:block;}
        .section-title{font-weight:bold;background-color:#e0e0e0;padding:4px;
          border:1px solid #000;margin-bottom:0;border-bottom:none;
          text-align:center;font-size:11px;}
      </style>

      <!-- EMPLOYEE INFO -->
      <table class="trf-table">
        <tr>
          <td style="width:20%;background-color:#f9f9f9;">
            <b>Employee ID</b><span class="sub-label">ID Karyawan</span>
          </td>
          <td style="width:30%;font-weight:bold;">
            ${(trf.employee as any)?.employeeCode ?? trf.employee?.id?.slice(0,7) ?? '-'}
          </td>
          <td style="width:20%;background-color:#f9f9f9;">
            <b>Name</b><span class="sub-label">Nama</span>
          </td>
          <td style="width:30%;font-weight:bold;">${trf.employee?.employeeName ?? '-'}</td>
        </tr>
        <tr>
          <td style="background-color:#f9f9f9;"><b>Department</b><span class="sub-label">Departemen</span></td>
          <td>${trf.employee?.department ?? trf.department ?? '-'}</td>
          <td style="background-color:#f9f9f9;"><b>Job Title</b><span class="sub-label">Jabatan</span></td>
          <td>${trf.employee?.jobTitle ?? '-'}</td>
        </tr>
        <tr>
          <td style="background-color:#f9f9f9;"><b>Date of Hire</b><span class="sub-label">Tanggal Mulai Bekerja</span></td>
          <td>${fmtDate(trf.employee?.dateOfHire)}</td>
          <td style="background-color:#f9f9f9;"><b>Phone Number</b><span class="sub-label">No. Telepon</span></td>
          <td>${trf.employee?.phone ?? '-'}</td>
        </tr>
        <tr>
          <td style="background-color:#f9f9f9;"><b>Point Of Hire</b><span class="sub-label">Tempat Penerimaan</span></td>
          <td>${trf.employee?.pointOfHire ?? '-'}</td>
          <td style="background-color:#f9f9f9;"><b>Email Address</b><span class="sub-label">Alamat Email</span></td>
          <td>${trf.employee?.email ?? '-'}</td>
        </tr>
      </table>

      <!-- TRAVEL PURPOSE -->
      <div class="section-title">TRAVEL PURPOSE / JENIS PERJALANAN</div>
      <table class="trf-table" style="border-top:none;">
        <thead>
          <tr>
            <th style="width:5%;text-align:center;">No</th>
            <th style="width:22%;text-align:center;">Start Date<span class="sub-label">Tanggal Mulai</span></th>
            <th style="width:22%;text-align:center;">End Date<span class="sub-label">Tanggal Selesai</span></th>
            <th style="width:16%;text-align:center;">Num of Days<span class="sub-label">Jumlah Hari</span></th>
            <th style="width:35%;">Purpose<span class="sub-label">Tujuan Perjalanan</span></th>
          </tr>
        </thead>
        <tbody>
          ${purposeRows.map((r, i) => `
          <tr>
            <td style="text-align:center;vertical-align:middle;">${r.start ? i + 1 : ''}</td>
            <td style="text-align:center;">${r.start}</td>
            <td style="text-align:center;">${r.end}</td>
            <td style="text-align:center;">${r.days ? r.days + ' days' : ''}</td>
            <td style="font-weight:${r.purpose ? '600' : '400'};">${r.purpose}</td>
          </tr>`).join('')}
        </tbody>
      </table>

      <!-- ACCOMMODATION -->
      <div class="section-title">ACCOMMODATION / AKOMODASI PERJALANAN</div>
      <table class="trf-table" style="border-top:none;">
        <thead>
          <tr>
            <th style="width:5%;text-align:center;">No</th>
            <th style="width:30%;">Type<span class="sub-label">Tipe Akomodasi</span></th>
            <th style="width:18%;text-align:center;">Check In<span class="sub-label">Tanggal Masuk</span></th>
            <th style="width:18%;text-align:center;">Check Out<span class="sub-label">Tanggal Keluar</span></th>
            <th>Remarks<span class="sub-label">Catatan</span></th>
          </tr>
        </thead>
        <tbody>
          ${accomRows.map((r, i) => `
          <tr>
            <td style="text-align:center;">${r.type ? i + 1 : ''}</td>
            <td>${r.type}</td>
            <td style="text-align:center;">${r.checkIn}</td>
            <td style="text-align:center;">${r.checkOut}</td>
            <td>${r.remarks}</td>
          </tr>`).join('')}
        </tbody>
      </table>

      <!-- TRAVEL ARRANGEMENT -->
      <!-- Menambahkan kolom Type (Travel In / Travel Out) -->
      <div class="section-title">TRAVEL ARRANGEMENT / PENGATURAN PERJALANAN</div>
      <table class="trf-table" style="border-top:none;">
        <thead>
          <tr>
            <th style="width:5%;text-align:center;">No</th>
            <th style="width:12%;text-align:center;">Date<span class="sub-label">Tanggal</span></th>
            <th style="width:14%;">Type<span class="sub-label">Tipe</span></th>
            <th style="width:18%;">From<span class="sub-label">Dari</span></th>
            <th style="width:18%;">To<span class="sub-label">Tujuan</span></th>
            <th style="width:15%;">Transport<span class="sub-label">Kendaraan</span></th>
            <th>Remarks<span class="sub-label">Keterangan</span></th>
          </tr>
        </thead>
        <tbody>
          ${arrRows.map((r, i) => `
          <tr>
            <td style="text-align:center;">${r.date ? i + 1 : ''}</td>
            <td style="text-align:center;">${r.date}</td>
            <td style="font-weight:${r.type !== '-' && r.type ? '600' : '400'};">${r.type}</td>
            <td>${r.from}</td>
            <td>${r.to}</td>
            <td>${r.transport}</td>
            <td>${r.remarks}</td>
          </tr>`).join('')}
        </tbody>
      </table>

      <!-- LUMPSUM -->
      <div class="section-title">TRAVEL ALLOWANCE (LUMPSUM)</div>
      <table class="trf-table" style="border-top:none;">
        <tr>
          <td style="width:70%;"><b>Total Amount</b><span class="sub-label" style="display:inline;"> / Jumlah Lumpsum</span></td>
          <td style="width:30%;font-weight:bold;text-align:right;">
            IDR ${trf.lumpsumAmount ? trf.lumpsumAmount.toLocaleString('id-ID') : '-'}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="color:#555;font-size:10px;">
            <i>Note: ${trf.lumpsumNote ?? 'No special remarks'}</i>
          </td>
        </tr>
      </table>

      <!-- AUTHORIZATION -->
      <div style="margin-top:15px;">
        <b style="font-size:11px;">AUTHORIZATION</b>
        <table class="trf-table" style="margin-top:5px;text-align:center;">
          <tr>
            <th style="width:20%;text-align:center;">Requested By<br/><span class="sub-label">Karyawan</span></th>
            <th style="width:20%;text-align:center;">Dept. Head<br/><span class="sub-label">Pimpinan Departemen</span></th>
            <th style="width:20%;text-align:center;">HR Manager<br/><span class="sub-label">Departemen HR</span></th>
            <th style="width:20%;text-align:center;">Project Manager<br/><span class="sub-label">PM</span></th>
            <th style="width:20%;text-align:center;">Processed By<br/><span class="sub-label">Admin / GA</span></th>
          </tr>
          <tr>
            <td style="height:60px;vertical-align:bottom;position:relative;">
              <b>${trf.employee?.employeeName ?? '________________'}</b><br/>
              <span style="font-size:9px;">${fmtDate(trf.submittedAt)}</span>
            </td>
            <td style="height:70px;vertical-align:bottom;position:relative;padding-top:30px;">
  ${hodApproved ? buildApprovedStamp(trf.parallelApproval?.hod?.actionAt) : ''}
  <b>${trf.parallelApproval?.hod?.actionByName ?? '________________'}</b><br/>
  <span style="font-size:9px;">Status</span>
</td>
<td style="height:70px;vertical-align:bottom;position:relative;padding-top:30px;">
  ${hrApproved ? buildApprovedStamp(trf.parallelApproval?.hr?.actionAt) : ''}
  <b>${trf.parallelApproval?.hr?.actionByName ?? '________________'}</b><br/>
  <span style="font-size:9px;">Status</span>
</td>
<td style="height:70px;vertical-align:bottom;position:relative;padding-top:30px;">
  ${pmApproved ? buildApprovedStamp(trf.pmApproval?.approvedAt) : ''}
  <b>${trf.pmApproval?.approverName ?? '________________'}</b><br/>
  <span style="font-size:9px;">Status</span>
</td>
<td style="height:70px;vertical-align:bottom;position:relative;padding-top:30px;">
  ${gaProcessed ? buildProcessedStamp(trf.gaProcess?.processedAt) : ''}
  <b>${trf.gaProcess?.processorName ?? '________________'}</b><br/>
  <span style="font-size:9px;">Status</span>
</td>
          </tr>
        </table>
      </div>

      <!-- FOOTER -->
      <div style="margin-top:10px;font-size:8px;color:#555;line-height:1.3;">
        <p style="margin:2px 0;">* Site Travel Services akan mengatur penerbangan kelas ekonomi dengan rute yang tercepat dan biaya paling efektif sesuai ketersediaan maskapai.</p>
        <p style="margin:2px 0;">* Setiap pembatalan atau perubahan perjalanan FIFO/TAMU wajib diinfokan kepada Site Travel Services untuk pengaturan lebih lanjut.</p>
        <p style="margin:2px 0;">* Batas toleransi tunggu untuk pengantaran FIFO ke Stasiun/Bandara adalah 10 menit dari jadwal keberangkatan.</p>
      </div>
    </div>`;
};

// ─────────────────────────────────────────────────────────────
// 3. MAIN EXPORT
// ─────────────────────────────────────────────────────────────
export const exportTRFToPDF = async (trf: TRF): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;z-index:9999;pointer-events:none;';

    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;top:0;left:0;width:794px;background:#fff;';
    container.innerHTML = buildHTML(trf);

    wrapper.appendChild(container);
    document.body.appendChild(wrapper);

    try {
      await new Promise(r => setTimeout(r, 500));

      const canvas = await html2canvas(container, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: '#ffffff', logging: false,
        width: 794, height: container.scrollHeight,
        windowWidth: 794, windowHeight: container.scrollHeight,
      });

      if (canvas.width === 0 || canvas.height === 0)
        throw new Error('Canvas render gagal (ukuran 0).');

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      if (!imgData || imgData === 'data:,')
        throw new Error('Canvas toDataURL gagal.');

      const pdf      = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight= pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight= (imgProps.height * pdfWidth) / imgProps.width;

      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
      } else {
        const scale    = canvas.width / pdfWidth;
        const pageHtPx = Math.floor(pdfHeight * scale);
        let yPx = 0, pg = 0;
        while (yPx < canvas.height) {
          if (pg > 0) pdf.addPage();
          const sliceHt = Math.min(pageHtPx, canvas.height - yPx);
          const pc = document.createElement('canvas');
          pc.width = canvas.width; pc.height = sliceHt;
          const ctx = pc.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pc.width, pc.height);
          ctx.drawImage(canvas, 0, yPx, canvas.width, sliceHt, 0, 0, canvas.width, sliceHt);
          pdf.addImage(pc.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, pdfWidth, (sliceHt * pdfWidth) / canvas.width);
          yPx += pageHtPx; pg++;
        }
      }

      pdf.save(`TRF_${trf.trfNumber ?? 'Draft'}_${new Date().toISOString().slice(0,10)}.pdf`);
      resolve();
    } catch (error) {
      console.error('Gagal export ke PDF:', error);
      reject(error);
    } finally {
      if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
    }
  });
};
