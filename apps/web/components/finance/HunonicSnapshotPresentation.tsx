import React from 'react';
import { Badge } from '../ui/Badge';
import { Zap, Droplets, AlertTriangle, CheckCircle, Users } from 'lucide-react';

export interface HunonicSnapshotData {
  roomCode: string;
  buildingName: string;
  cycleMonth: string; // e.g. "09/2026"
  isLive: boolean;
  pricingMode?: 'residential' | 'custom';
  electricity: {
    startReading: number;
    endReading: number;
    totalKwh: number;
    unitPrice?: number;
    totalAmount?: number;
  };
  water?: {
    occupantCount: number;
    unitPricePerPerson: number; // 100,000 VND
    totalAmount: number;
  };
  tenantShares?: Array<{
    customerId: string;
    customerName: string;
    sharePercent: number;
    electricityAmount: number;
    waterAmount: number;
    totalAmount: number;
  }>;
}

export interface HunonicSnapshotPresentationProps {
  data: HunonicSnapshotData;
  className?: string;
}

/**
 * Presentational component for Hunonic smart meter & utility snapshot breakdown.
 * Complies with CORE-07 presentation rules:
 * - Live vs Snapshot badge
 * - Live operational readings are reference-only, never billing truth
 * - Locked snapshots may render API-provided billing breakdowns
 */
export const HunonicSnapshotPresentation: React.FC<HunonicSnapshotPresentationProps> = ({
  data,
  className = '',
}) => {
  const { roomCode, buildingName, cycleMonth, isLive, electricity } = data;
  const water = data.water;
  const tenantShares = data.tenantShares || [];

  // This is a display-only consistency signal for server-provided locked values.
  const calculatedTotal = (electricity.totalAmount || 0) + (water?.totalAmount || 0);
  const sumTenantTotals = tenantShares.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const hasRoundingMismatch = !isLive && Boolean(water) && tenantShares.length > 0 && Math.abs(calculatedTotal - sumTenantTotals) > tenantShares.length;

  return (
    <div className={`flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-xs ${className}`}>
      {/* Header with Live vs Snapshot Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-text">
            {buildingName} · Phòng {roomCode}
          </span>
          <span className="text-xs text-muted">Kỳ {cycleMonth}</span>
        </div>
        <div>
          {isLive ? (
            <Badge data-testid="hunonic-source-live-operational" aria-label="Nguồn dữ liệu: dữ liệu công tơ trực tiếp, chỉ tham khảo" variant="warning" className="flex items-center gap-1 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
              Công tơ trực tiếp (tham khảo)
            </Badge>
          ) : (
            <Badge data-testid="hunonic-source-locked-snapshot" aria-label="Nguồn dữ liệu: snapshot kỳ chốt đã khóa" variant="success" className="flex items-center gap-1 font-bold">
              <CheckCircle size={12} />
              Snapshot kỳ chốt
            </Badge>
          )}
        </div>
      </div>

      {isLive && (
        <div
          data-testid="hunonic-live-reference-warning"
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Dữ liệu công tơ trực tiếp chỉ để tham khảo, không phải số lập hóa đơn. Hóa đơn chỉ dùng snapshot đã khóa từ hệ thống.</span>
        </div>
      )}

      {/* Utilities Breakdown Grid */}
      <div className={`grid grid-cols-1 ${isLive ? "" : "md:grid-cols-2"} gap-3`}>
        {/* Electricity */}
        <div className="rounded-xl border border-border/50 bg-surface/40 p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 flex-wrap">
            <Zap size={15} />
            <span>Điện tiêu thụ (Công tơ thông minh Hunonic)</span>
            {!isLive && data.pricingMode && (
              <Badge variant={data.pricingMode === 'custom' ? 'primary' : 'neutral'} className="text-[10px] font-mono shrink-0">
                {data.pricingMode === 'custom' ? 'Giá tùy chỉnh' : 'Bậc thang'}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-text">
              {electricity.totalKwh.toLocaleString('vi-VN')} kWh
            </span>
            {!isLive && typeof electricity.totalAmount === "number" && (
              <span className="text-sm font-bold text-primary">
                {electricity.totalAmount.toLocaleString('vi-VN')} đ
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-muted flex justify-between">
            <span>Chỉ số: {electricity.startReading} ➔ {electricity.endReading}</span>
            {!isLive && typeof electricity.unitPrice === "number" && <span>Đơn giá: {electricity.unitPrice.toLocaleString('vi-VN')} đ/kWh</span>}
          </div>
        </div>

        {/* Water */}
        {!isLive && water && <div className="rounded-xl border border-border/50 bg-surface/40 p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400">
            <Droplets size={15} />
            <span>Nước sinh hoạt (Định mức theo người)</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-text">
              {water.occupantCount} người
            </span>
            <span className="text-sm font-bold text-primary">
              {water.totalAmount.toLocaleString('vi-VN')} đ
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted flex justify-between">
            <span>Định mức: {water.unitPricePerPerson.toLocaleString('vi-VN')} đ/người</span>
            <span>Công thức: {water.unitPricePerPerson.toLocaleString('vi-VN')}đ × {water.occupantCount}</span>
          </div>
        </div>}
      </div>

      {/* Rounding Warning if any */}
      {hasRoundingMismatch && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle size={15} className="shrink-0" />
          <span>Cảnh báo: Tổng tiền phân bổ các khách lệch so với tổng tiền dịch vụ cả phòng do làm tròn.</span>
        </div>
      )}

      {/* Tenant Share Breakdown */}
      {!isLive && tenantShares.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
            <Users size={14} />
            <span>Phân bổ theo khách trong phòng ({tenantShares.length} người)</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/40 bg-surface/20">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/30 bg-surface/50 text-muted font-bold text-[11px] uppercase">
                <tr>
                  <th className="px-3 py-2">Khách thuê</th>
                  <th className="px-3 py-2 text-right">Tỷ lệ</th>
                  <th className="px-3 py-2 text-right">Tiền điện</th>
                  <th className="px-3 py-2 text-right">Tiền nước</th>
                  <th className="px-3 py-2 text-right">Tổng cộng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {tenantShares.map((share) => (
                  <tr key={share.customerId} className="hover:bg-surface/40">
                    <td className="px-3 py-2 font-bold text-text">{share.customerName}</td>
                    <td className="px-3 py-2 text-right text-muted">{Math.round(share.sharePercent * 100)}%</td>
                    <td className="px-3 py-2 text-right font-medium">{share.electricityAmount.toLocaleString('vi-VN')} đ</td>
                    <td className="px-3 py-2 text-right font-medium">{share.waterAmount.toLocaleString('vi-VN')} đ</td>
                    <td className="px-3 py-2 text-right font-black text-primary">{share.totalAmount.toLocaleString('vi-VN')} đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
