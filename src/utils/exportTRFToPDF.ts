import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { TRF } from '@/types';

// ─────────────────────────────────────────────────────────────
// 1. HELPER FORMATTING (Wajib ada di paling atas)
// ─────────────────────────────────────────────────────────────
const fmtDate = (d?: string): string => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const numDays = (start?: string, end?: string): string => {
  if (!start || !end) return '-';
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return `${diff}`;
};

// ─────────────────────────────────────────────────────────────
// 2. TEMPLATE HTML GENERATOR (Sudah diperbaiki wrapper & typonya)
// ─────────────────────────────────────────────────────────────
const buildHTML = (trf: TRF): string => {
  const arrangements = trf.travelArrangements || [];
  
  // Helper karakter Checkbox
  const getCheck = (condition: boolean) => (condition ? '☑' : '☐');

  return `
    <div id="pdf-export-container" style="
      width: 794px; /* A4 width in pixels at 96 DPI */
      padding: 40px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      color: #000;
      background-color: #fff;
      line-height: 1.4;
      box-sizing: border-box;
    ">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0; font-size: 18px; font-weight: bold;">TRAVEL REQUEST FORM</h2>
          <p style="margin: 0; font-style: italic; color: #555;">Formulir Permohonan Perjalanan</p>
          <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 12px;">TRF No: ${trf.trfNumber || '-'}</p>
        </div>
        
        <div style="text-align: right;">
           <img src="/LogoMerdeka.png" style="height: 50px; width: auto; max-width: 150px; object-fit: contain;" alt="Logo Merdeka Mining Service" />
        </div>
      </div>

      <style>
        .trf-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        .trf-table th, .trf-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
        .trf-table th { background-color: #f2f2f2; font-weight: bold; text-align: left; }
        .sub-label { font-size: 9px; font-style: italic; color: #555; display: block; }
        .section-title { font-weight: bold; background-color: #e0e0e0; padding: 5px; border: 1px solid #000; margin-bottom: 0; border-bottom: none; text-align: center; font-size: 12px;}
      </style>

      <table class="trf-table">
        <tr>
          <td style="width: 20%; background-color:#f9f9f9;"><b>Employee ID</b><span class="sub-label">ID Karyawan</span></td>
          <td style="width: 30%; font-weight: bold;">${(trf.employee as any)?.employeeCode || trf.employee?.id?.slice(0, 7) || '-'}</td>
          <td style="width: 20%; background-color:#f9f9f9;"><b>Name</b><span class="sub-label">Nama</span></td>
          <td style="width: 30%; font-weight: bold;">${trf.employee?.employeeName || '-'}</td>
        </tr>
        <tr>
          <td style="background-color:#f9f9f9;"><b>Department</b><span class="sub-label">Departemen</span></td>
          <td>${trf.employee?.department || '-'}</td>
          <td style="background-color:#f9f9f9;"><b>Job Title</b><span class="sub-label">Jabatan</span></td>
          <td>${trf.employee?.jobTitle || '-'}</td>
        </tr>
        <tr>
          <td style="background-color:#f9f9f9;"><b>Date of Hire</b><span class="sub-label">Tanggal Mulai Bekerja</span></td>
          <td>${fmtDate(trf.employee?.dateOfHire)}</td>
          <td style="background-color:#f9f9f9;"><b>Phone Number</b><span class="sub-label">No. Telepon</span></td>
          <td>${trf.employee?.phone || '-'}</td>
        </tr>
        <tr>
          <td style="background-color:#f9f9f9;"><b>Point Of Hire</b><span class="sub-label">Tempat Penerimaan</span></td>
          <td>${trf.employee?.pointOfHire || '-'}</td>
          <td style="background-color:#f9f9f9;"><b>Email Address</b><span class="sub-label">Alamat Email</span></td>
          <td>${trf.employee?.email || '-'}</td>
        </tr>
      </table>

      <table class="trf-table">
        <tr>
          <td colspan="4" style="background-color:#f9f9f9;">
            <b>Travel Purpose</b> <span class="sub-label" style="display:inline;">/ Jenis Perjalanan (Mandatory)</span><br/>
            <div style="margin-top: 8px; display: flex; gap: 20px;">
              <span><span style="font-size:14px">${getCheck(trf.travelPurpose === 'ANNUAL_LEAVE')}</span> Annual Leave</span>
              <span><span style="font-size:14px">${getCheck(trf.travelPurpose === 'FIELD_BREAK')}</span> Field Break</span>
              <span><span style="font-size:14px">${getCheck(trf.travelPurpose === 'TRAINING')}</span> Training/Meeting</span>
              <span><span style="font-size:14px">${getCheck(!['ANNUAL_LEAVE', 'FIELD_BREAK', 'TRAINING'].includes(trf.travelPurpose || ''))}</span> Others: ${trf.purposeRemarks || '________________'}</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="width: 25%;"><b>Start Date</b><span class="sub-label">Tanggal Mulai</span><br/>${fmtDate(trf.startDate)}</td>
          <td style="width: 25%;"><b>End Date</b><span class="sub-label">Tanggal Selesai</span><br/>${fmtDate(trf.endDate)}</td>
          <td style="width: 25%;"><b>Number of days</b><span class="sub-label">Jumlah Hari</span><br/>${numDays(trf.startDate, trf.endDate)} Hari</td>
          <td style="width: 25%;"><b>Accommodation</b><span class="sub-label">Akomodasi</span><br/>${trf.accommodation?.hotelName || 'Site Service'}</td>
        </tr>
      </table>

      <div class="section-title">TRAVEL ARRANGEMENT / PENGATURAN PERJALANAN</div>
      <table class="trf-table" style="border-top: none;">
        <thead>
          <tr>
            <th style="width: 15%;">Date<span class="sub-label">Tanggal</span></th>
            <th style="width: 20%;">From<span class="sub-label">Dari</span></th>
            <th style="width: 20%;">To<span class="sub-label">Tujuan</span></th>
            <th style="width: 25%;">Transport<span class="sub-label">Kendaraan</span></th>
            <th style="width: 20%;">Remarks<span class="sub-label">Keterangan</span></th>
          </tr>
        </thead>
        <tbody>
          ${arrangements.length > 0 ? arrangements.map(arr => `
            <tr>
              <td>${fmtDate(arr.travelDate)}</td>
              <td>${arr.fromLocation || '-'}</td>
              <td>${arr.toLocation || '-'}</td>
              <td>${(arr.transportation || '-').replace(/_/g, ' ')}</td>
              <td>${arr.remarks || '-'}</td>
            </tr>
          `).join('') : `
            <tr><td colspan="5" style="text-align:center; padding: 20px;">No travel arrangements recorded.</td></tr>
          `}
        </tbody>
      </table>

      <div class="section-title">TRAVEL ALLOWANCE (LUMPSUM)</div>
      <table class="trf-table" style="border-top: none;">
        <tr>
          <td style="width: 70%;"><b>Total Amount</b> <span class="sub-label" style="display:inline;">/ Jumlah Lumpsum</span></td>
          <td style="width: 30%; font-weight: bold; text-align: right;">IDR ${trf.lumpsumAmount ? trf.lumpsumAmount.toLocaleString('id-ID') : '-'}</td>
        </tr>
        <tr>
          <td colspan="2" style="color: #555; font-size: 10px;"><i>Note: ${trf.lumpsumNote || 'No special remarks'}</i></td>
        </tr>
      </table>

      <div style="margin-top: 30px;">
        <b style="font-size: 12px;">AUTHORIZATION</b>
        <table class="trf-table" style="margin-top: 5px; text-align: center;">
          <tr>
            <th style="width: 25%; text-align: center;">Requested By<br/><span class="sub-label">Karyawan</span></th>
            <th style="width: 25%; text-align: center;">Dept. Head<br/><span class="sub-label">Pimpinan Departemen</span></th>
            <th style="width: 25%; text-align: center;">HR Manager<br/><span class="sub-label">Departemen HR</span></th>
            <th style="width: 25%; text-align: center;">Processed By<br/><span class="sub-label">Admin / GA</span></th>
          </tr>
          <tr>
            <td style="height: 70px; vertical-align: bottom;">
              <b>${trf.employee?.employeeName || '________________'}</b><br/>
              <span style="font-size: 9px;">${fmtDate(trf.submittedAt)}</span>
            </td>
            <td style="height: 70px; vertical-align: bottom; position: relative;">
               ${trf.parallelApproval?.hod?.status === 'APPROVED' ? `<div style="position:absolute; top:20px; left:50%; transform:translateX(-50%) rotate(-15deg); color:green; font-weight:bold; border:2px solid green; padding:2px 5px; border-radius:4px; opacity:0.6;">APPROVED</div>` : ''}
              <b>${trf.parallelApproval?.hod?.actionByName || '________________'}</b><br/>
              <span style="font-size: 9px;">${trf.parallelApproval?.hod?.actionAt ? fmtDate(trf.parallelApproval.hod.actionAt) : 'Date:'}</span>
            </td>
            <td style="height: 70px; vertical-align: bottom;">
              <b>________________</b><br/>
              <span style="font-size: 9px;">Date:</span>
            </td>
            <td style="height: 70px; vertical-align: bottom; position: relative;">
               ${trf.status === 'GA_PROCESSED' || trf.status === 'COMPLETED' ? `<div style="position:absolute; top:20px; left:50%; transform:translateX(-50%) rotate(-15deg); color:blue; font-weight:bold; border:2px solid blue; padding:2px 5px; border-radius:4px; opacity:0.6;">PROCESSED</div>` : ''}
              <b>${trf.processedBy || '________________'}</b><br/>
              <span style="font-size: 9px;">Date:</span>
            </td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 15px; font-size: 8px; color: #555;">
        <p style="margin: 2px 0;">* Site Travel Services akan mengatur penerbangan kelas ekonomi dengan rute yang tercepat dan biaya paling efektif sesuai ketersediaan maskapai.</p>
        <p style="margin: 2px 0;">* Setiap pembatalan atau perubahan perjalanan FIFO/TAMU wajib diinfokan kepada Site Travel Services untuk pengaturan lebih lanjut.</p>
        <p style="margin: 2px 0;">* Batas toleransi tunggu untuk pengantaran FIFO ke Stasiun/Bandara adalah 10 menit dari jadwal keberangkatan.</p>
      </div>
    </div>
  `;
};

// ─────────────────────────────────────────────────────────────
// 3. MAIN EXPORT FUNCTION
// ─────────────────────────────────────────────────────────────
export const exportTRFToPDF = async (trf: TRF): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Buat kontainer div di luar layar
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.innerHTML = buildHTML(trf);
      document.body.appendChild(container);

      const targetEl = document.getElementById('pdf-export-container');
      if (!targetEl) throw new Error('Elemen PDF tidak ditemukan');

      // Tunggu render gambar logo selesai sebentar
      await new Promise(r => setTimeout(r, 500));

      // 2. Render dengan html2canvas
      const canvas = await html2canvas(targetEl, {
        scale: 2, // Kualitas resolusi tinggi agar tidak blur
        useCORS: true,
        logging: false,
      });

      // Hapus kontainer sementara dari DOM
      document.body.removeChild(container);

      // 3. Konversi Canvas ke PDF menggunakan jsPDF
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);

      // 4. Download File otomatis
      const filename = `TRF_${trf.trfNumber || 'Draft'}_${new Date().toISOString().slice(0,10)}.pdf`;
      pdf.save(filename);

      resolve();
    } catch (error) {
      console.error('Gagal export ke PDF:', error);
      reject(error);
    }
  });
};