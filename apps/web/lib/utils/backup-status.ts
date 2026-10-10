export function backupStatusLabel(status: string) {
  switch (status) {
    case 'READY': return 'Đã kiểm tra';
    case 'FAILED': return 'Sao lưu thất bại';
    case 'INCOMPLETE': return 'Không đầy đủ';
    default: return 'Chưa đạt kiểm tra';
  }
}
