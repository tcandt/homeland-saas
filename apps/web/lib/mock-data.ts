export const mockData = {
  hero: {
    tasksCount: 8,
    debt: "42.500.000 đ",
    expiringContracts: 3,
    cleaningRooms: 2,
  },
  alerts: [
    { count: 8, label: "Hóa đơn quá hạn", amount: "42.500.000 đ", color: "red" },
    { count: 3, label: "Hợp đồng sắp hết hạn", amount: "Trong 7 ngày", color: "orange" },
    { count: 2, label: "Phòng cần dọn", amount: "Check-out hôm nay", color: "yellow" },
    { count: 1, label: "Cọc chờ xử lý", amount: "Trong 2 ngày", color: "purple" },
  ],
  insights: [
    { text: "Công nợ tăng", highlight: "18%", sub: "So với cùng kỳ tháng trước", icon: "📈", type: "danger" },
    { text: "LK08.25 tỷ lệ lấp đầy giảm", highlight: "", sub: "Giảm 10% so với tháng trước", icon: "⚠", type: "warning" },
    { text: "3 khách có nguy cơ nợ xấu", highlight: "", sub: "Tổng nợ: 25.600.000 đ", icon: "👤", type: "warning" },
    { text: "Doanh thu dự báo giảm", highlight: "", sub: "Tháng tới giảm 12.000.000 đ", icon: "↘", type: "success" },
  ],
  kpis: [
    { label: "Doanh thu tháng này", value: "285.000.000 đ", trend: "↑ 12.5% so với tháng trước", positive: true, icon: "green" },
    { label: "Công nợ phải thu", value: "67.000.000 đ", trend: "↑ 18.2% so với tháng trước", positive: false, icon: "blue" },
    { label: "Tỷ lệ lấp đầy", value: "87%", trend: "↑ 7.5% so với tháng trước", positive: true, icon: "purple" },
    { label: "Lợi nhuận ước tính", value: "176.000.000 đ", trend: "↑ 10.4% so với tháng trước", positive: true, icon: "orange" },
  ],
  buildings: [
    { id: "LK01.31", rooms: 9, fillRate: 89, status: "1 hóa đơn quá hạn", statusType: "danger" },
    { id: "LK01.32", rooms: 8, fillRate: 87, status: "1 HĐ sắp hết hạn", statusType: "warning" },
    { id: "LK08.24", rooms: 10, fillRate: 100, status: "Ổn định", statusType: "success" },
    { id: "LK08.25", rooms: 10, fillRate: 80, status: "2 vấn đề", statusType: "danger" },
  ],
  tasks: [
    { id: 1, title: "Gọi khách Nguyễn Văn A", sub: "Phòng 201 - LK01.31", time: "09:00", checked: false },
    { id: 2, title: "Xử lý hóa đơn INV-000201", sub: "Phòng 301 - LK08.24", time: "10:30", checked: false },
    { id: 3, title: "Kiểm tra phòng 301", sub: "Phòng 301 - LK01.32 hôm nay", time: "11:00", checked: false },
    { id: 4, title: "Duyệt hợp đồng HD-2024-015", sub: "Phòng 402 - LK08.25", time: "14:00", checked: false },
  ],
  revenueChart: [
    { month: "T01/2026", revenue: 45, profit: 30 },
    { month: "T02/2026", revenue: 60, profit: 40 },
    { month: "T03/2026", revenue: 75, profit: 50 },
    { month: "T04/2026", revenue: 55, profit: 35 },
    { month: "T05/2026", revenue: 70, profit: 45 },
    { month: "T06/2026", revenue: 85, profit: 55 },
  ],
  activities: [
    { time: "09:30", text: "Manager xác nhận thanh toán", amount: "+9.500.000 đ", positive: true },
    { time: "09:05", text: "Sales tạo cọc phòng LK08.24", amount: "+5.000.000 đ", positive: true },
    { time: "08:40", text: "Admin cập nhật hợp đồng HD-000121", amount: "", positive: true },
    { time: "08:10", text: "Hệ thống gửi Zalo nhắc nợ", amount: "+8.200.000 đ", positive: true },
  ],
  forecast: [
    { id: "LK01.31", rate: 95 },
    { id: "LK01.32", rate: 88 },
    { id: "LK08.24", rate: 100 },
    { id: "LK08.25", rate: 70 },
  ],
};
