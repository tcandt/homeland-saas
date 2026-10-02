export function formatVnd(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  return `${num.toLocaleString("vi-VN")} đ`;
}

export function formatNumber(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  return num.toLocaleString("vi-VN");
}

export function formatMillions(val: number | string | null | undefined): string {
  const num = Number(val || 0);
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${(num / 1_000).toFixed(0)}K`;
  }
  return String(num);
}
