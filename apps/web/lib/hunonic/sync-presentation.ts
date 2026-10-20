export function syncPhaseLabel(phase?: string) {
  const labels: Record<string, string> = {
    queued: "Đang chờ xử lý",
    discovering: "Đang kiểm kê thiết bị",
    backfilling: "Đang tải lịch sử chỉ số",
    syncing: "Đang đồng bộ công tơ",
    completed: "Đã hoàn tất",
    failed: "Đồng bộ thất bại",
  };
  return labels[String(phase || "").toLowerCase()] || "Đang xử lý";
}
