import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Data') => {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate filename with timestamp
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const fullFilename = `${filename}_${timestamp}.xlsx`;

  // Save the file
  XLSX.writeFile(workbook, fullFilename);
};

export const exportWorkerIncomeToExcel = (data: any[], workers: any[]) => {
  const exportData = data.map(item => ({
    'Kode': item.code,
    'Job Desk': item.jobdesk,
    'Worker': workers.find(w => w.id === item.worker_id)?.nama || 'Unknown',
    'Fee': item.fee,
    'Tanggal': format(new Date(item.tanggal), 'dd/MM/yyyy HH:mm')
  }));

  exportToExcel(exportData, 'pendapatan_worker', 'Pendapatan Worker');
};

export const exportAdminIncomeToExcel = (data: any[]) => {
  const exportData = data.map(item => ({
    'Kode': item.code,
    'Nominal': item.nominal,
    'Tanggal': format(new Date(item.tanggal), 'dd/MM/yyyy HH:mm')
  }));

  exportToExcel(exportData, 'pendapatan_admin', 'Pendapatan Admin');
};

export const exportExpensesToExcel = (data: any[]) => {
  const exportData = data.map(item => ({
    'Nominal': item.nominal,
    'Keterangan': item.keterangan,
    'Tanggal': format(new Date(item.tanggal), 'dd/MM/yyyy HH:mm')
  }));

  exportToExcel(exportData, 'pengeluaran', 'Pengeluaran');
};

export const exportWorkersToExcel = (data: any[]) => {
  const exportData = data.map(item => ({
    'Nama': item.nama,
    'Rekening': item.rekening || '-',
    'WhatsApp': item.wa || '-',
    'Role': item.role || '-',
    'Status': item.status,
    'Created At': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')
  }));

  exportToExcel(exportData, 'workers_data', 'Data Workers');
};

export const exportWorkerRekapToExcel = (data: any[]) => {
  const exportData = data.map(item => ({
    'Kode': item.code,
    'Job Desk': item.jobdesk,
    'Worker': item.worker_name,
    'Franchise': item.franchises?.name || '-',
    'Kode Franchise': item.franchises?.franchise_id || '-',
    'Fee': item.fee,
    'Tanggal': format(new Date(item.tanggal), 'dd/MM/yyyy HH:mm')
  }));

  exportToExcel(exportData, 'rekap_worker_wara', 'Rekap Worker Wara');
};

export const exportAdminRekapToExcel = (data: any[]) => {
  const exportData = data.map(item => ({
    'Kode': item.code,
    'Franchise': item.franchises?.name || '-',
    'Kode Franchise': item.franchises?.franchise_id || '-',
    'Nominal': item.nominal,
    'Tanggal': format(new Date(item.tanggal), 'dd/MM/yyyy HH:mm')
  }));

  exportToExcel(exportData, 'rekap_admin_wara', 'Rekap Admin Wara');
};