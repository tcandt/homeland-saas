"use client";

import React, { Fragment, useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronUp, HandCoins, ReceiptText, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useOwnerProfitDetailQuery, useOwnerProfitSummaryQuery } from "@/lib/queries/finance.queries";

const formatMoney = (value: number) => {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return value.toLocaleString("vi-VN");
};

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const categoryLabels: Record<string, string> = {
  SUPPLIES: "Vật tư / dụng cụ",
  REPAIR: "Sửa chữa",
  MAINTENANCE: "Bảo trì",
  UTILITY: "Điện nước chung",
  CLEANING: "Vệ sinh",
  REFUND: "Hoàn tiền khách",
  STAFF: "Nhân sự",
  OTHER: "Khác",
};

export default function OwnerProfitSummary() {
  const { data, isLoading } = useOwnerProfitSummaryQuery();
  const rows = Array.isArray(data) ? data : [];
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  return (
    <>
      <section data-testid="owner-profit-summary" className="overflow-hidden rounded-[16px] border border-border bg-card shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-border p-[16px] md:p-[20px]">
          <div>
            <h2 className="text-[16px] font-black text-text md:text-[18px]">Chia lợi nhuận theo chủ</h2>
            <p className="mt-1 text-[12px] text-muted md:text-[13px]">
              Tổng hợp doanh thu, chi phí, tiền ứng hộ và khoản cần khấu trừ cho từng chủ sở hữu.
            </p>
          </div>
          <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-[#8b5cf6]/10 text-[#8b5cf6] md:flex">
            <HandCoins size={18} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 xl:grid-cols-2">
          {isLoading && <div className="p-[20px] text-[13px] font-semibold text-muted">Đang tải báo cáo...</div>}

          {!isLoading && rows.length === 0 && (
            <div className="p-[20px] text-[13px] font-semibold text-muted">
              Chưa có dữ liệu chủ sở hữu. Hãy gắn chủ sở hữu cho tòa nhà để bắt đầu theo dõi.
            </div>
          )}

          {rows.map((row: any) => (
            <article key={row.owner.id} data-testid={`owner-profit-card-${row.owner.id}`} className="border-b border-border p-[16px] md:p-[20px] xl:odd:border-r">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-black text-text md:text-[16px]">{row.owner.name}</span>
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-black text-muted">{row.owner.code}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                    <Building2 size={13} />
                    {(row.buildings || []).map((building: any) => building.code).join(", ") || "Chưa gắn tòa"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="rounded-xl bg-[#10b981]/10 px-3 py-2 text-right">
                    <div className="text-[10px] font-black uppercase text-[#059669]">Còn lại</div>
                    <div className="text-[16px] font-black text-[#059669]">{formatMoney(Number(row.profitAfterAdvance || 0))}</div>
                  </div>
                  <Button data-testid={`owner-profit-open-${row.owner.id}`} size="sm" variant="outline" onClick={() => setSelectedOwnerId(row.owner.id)}>
                    Chi tiết
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Tổng thu" value={row.revenue} tone="income" />
                <Metric label="Tổng chi" value={row.expense} tone="expense" />
                <Metric label="Cần thu hoàn ứng" value={row.advanceReceivable} tone="income" />
                <Metric label="Cần khấu trừ" value={row.advancePayable} tone="expense" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <OwnerProfitDetailModal ownerId={selectedOwnerId} onClose={() => setSelectedOwnerId("")} />
    </>
  );
}

function OwnerProfitDetailModal({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null);
  const params = useMemo(() => ({ year, ...(month ? { month } : {}) }), [month, year]);
  const { data, isLoading, isError } = useOwnerProfitDetailQuery(ownerId, params);

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => {
        const value = String(currentYear - index);
        return { value, label: value };
      }),
    [currentYear],
  );

  const monthOptions = [
    { value: "", label: "Cả năm" },
    ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `Tháng ${index + 1}` })),
  ];

  const maxTrend = Math.max(...((data?.trend || []).map((item: any) => Math.abs(Number(item.profit || 0)))), 1);

  return (
    <Modal
      isOpen={!!ownerId}
      onClose={onClose}
      title={data?.owner?.name ? `Chi tiết ${data.owner.name}` : "Chi tiết chủ sở hữu"}
      maxWidth="max-w-6xl"
      zIndex={10050}
      testId="owner-profit-detail-modal"
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_150px_150px]">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wide text-[#16a34a]">Owner Profit Detail</div>
            <p className="mt-1 text-[13px] leading-6 text-muted">
              Lọc theo tháng/năm để xem doanh thu, chi phí, khoản hoàn ứng và lợi nhuận còn lại của từng chủ.
            </p>
          </div>
          <Select data-testid="owner-profit-detail-year" value={year} onChange={(event) => setYear(event.target.value)} options={yearOptions} />
          <Select data-testid="owner-profit-detail-month" value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptions} />
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-[13px] font-semibold text-muted">
            Đang tải chi tiết...
          </div>
        )}
        {isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-[13px] font-semibold text-rose-600">
            Không tải được báo cáo owner.
          </div>
        )}

        {!isLoading && !isError && data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
              <DetailMetric label="Tổng thu" value={data.summary?.revenue} tone="income" />
              <DetailMetric label="Tổng chi" value={data.summary?.expense} tone="expense" />
              <DetailMetric label="Trước hoàn ứng" value={data.summary?.profitBeforeAdvance} tone="income" />
              <DetailMetric label="Cần thu hoàn ứng" value={data.summary?.advanceReceivable} tone="income" />
              <DetailMetric
                testId="owner-profit-detail-advance-payable"
                label="Cần khấu trừ"
                value={data.summary?.advancePayable}
                tone="expense"
              />
              <DetailMetric testId="owner-profit-detail-after-advance" label="Còn lại" value={data.summary?.profitAfterAdvance} tone="income" />
            </div>

            <section data-testid="owner-profit-building-breakdown" className="overflow-hidden rounded-2xl border border-border">
              <div className="border-b border-border bg-surface px-4 py-3">
                <h3 className="text-[13px] font-black uppercase text-text">Tòa thuộc chủ</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="bg-surface text-[11px] uppercase text-muted">
                    <tr>
                      <th className="w-[52px] px-4 py-3 text-center font-black">Mở</th>
                      <th className="px-4 py-3 font-black">Tòa</th>
                      <th className="px-4 py-3 text-right font-black">Thuê phòng</th>
                      <th className="px-4 py-3 text-right font-black">Điện</th>
                      <th className="px-4 py-3 text-right font-black">Nước / DV</th>
                      <th className="px-4 py-3 text-right font-black">Khác</th>
                      <th className="px-4 py-3 text-right font-black">Doanh thu</th>
                      <th className="px-4 py-3 text-right font-black">Chi phí</th>
                      <th className="px-4 py-3 text-right font-black">Lợi nhuận</th>
                      <th className="px-4 py-3 text-right font-black">HĐ quá hạn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.buildingBreakdown || []).map((row: any) => {
                      const isExpanded = expandedBuildingId === row.building.id;

                      return (
                        <Fragment key={row.building.id}>
                          <tr data-testid={`owner-profit-building-row-${row.building.id}`} className="border-t border-border">
                            <td className="px-4 py-3 text-center">
                              <button
                                data-testid={`owner-profit-building-toggle-${row.building.id}`}
                                type="button"
                                onClick={() => setExpandedBuildingId((current) => (current === row.building.id ? null : row.building.id))}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-text transition hover:bg-surface"
                                aria-label={isExpanded ? "Thu gọn chi tiết tòa" : "Mở chi tiết tòa"}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </td>
                            <td className="px-4 py-3 font-black text-text">{row.building.code || row.building.name}</td>
                            <td className="px-4 py-3 text-right font-bold text-text">{formatVnd(row.revenueBreakdown?.rent || 0)}</td>
                            <td className="px-4 py-3 text-right font-bold text-amber-600">{formatVnd(row.revenueBreakdown?.electricity || 0)}</td>
                            <td className="px-4 py-3 text-right font-bold text-sky-600">{formatVnd(row.revenueBreakdown?.waterAndService || 0)}</td>
                            <td className="px-4 py-3 text-right font-bold text-violet-600">{formatVnd(row.revenueBreakdown?.other || 0)}</td>
                            <td className="px-4 py-3 text-right font-bold text-[#059669]">{formatVnd(row.revenue)}</td>
                            <td className="px-4 py-3 text-right font-bold text-rose-500">{formatVnd(row.expense)}</td>
                            <td className="px-4 py-3 text-right font-black text-text">{formatVnd(row.profit)}</td>
                            <td className="px-4 py-3 text-right font-bold text-text">{row.overdueInvoices || 0}</td>
                          </tr>

                          {isExpanded && (
                            <tr className="border-t border-border bg-surface/50">
                              <td colSpan={10} className="px-4 py-4">
                                <div className="overflow-hidden rounded-2xl border border-border bg-white">
                                  <div className="border-b border-border px-4 py-3">
                                    <div className="text-[12px] font-black uppercase text-muted">Doanh thu theo phòng</div>
                                    <div className="mt-1 text-[13px] text-muted">
                                      Tách riêng doanh thu thuê phòng, điện, nước / dịch vụ và khoản khác trong tòa {row.building.code || row.building.name}.
                                    </div>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table data-testid={`owner-profit-room-breakdown-${row.building.id}`} className="w-full min-w-[920px] text-left text-sm">
                                      <thead className="bg-surface text-[11px] uppercase text-muted">
                                        <tr>
                                          <th className="px-4 py-3 font-black">Phòng</th>
                                          <th className="px-4 py-3 text-right font-black">Thuê phòng</th>
                                          <th className="px-4 py-3 text-right font-black">Điện</th>
                                          <th className="px-4 py-3 text-right font-black">Nước / DV</th>
                                          <th className="px-4 py-3 text-right font-black">Khác</th>
                                          <th className="px-4 py-3 text-right font-black">Tổng thu</th>
                                          <th className="px-4 py-3 text-right font-black">HĐ</th>
                                          <th className="px-4 py-3 text-right font-black">Hóa đơn</th>
                                          <th className="px-4 py-3 text-right font-black">Chi phí</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(row.roomBreakdown || []).map((roomRow: any) => (
                                          <tr key={`${row.building.id}:${roomRow.room.id}`} className="border-t border-border">
                                            <td className="px-4 py-3">
                                              <div className="font-black text-text">{roomRow.room.code || roomRow.room.name}</div>
                                              <div className="text-[12px] text-muted">{roomRow.room.name || "Không có tên phòng"}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-text">{formatVnd(roomRow.revenueBreakdown?.rent || 0)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-amber-600">{formatVnd(roomRow.revenueBreakdown?.electricity || 0)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-sky-600">{formatVnd(roomRow.revenueBreakdown?.waterAndService || 0)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-violet-600">{formatVnd(roomRow.revenueBreakdown?.other || 0)}</td>
                                            <td className="px-4 py-3 text-right font-black text-[#059669]">{formatVnd(roomRow.revenue || 0)}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-muted">{roomRow.contracts?.length || 0}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-muted">{roomRow.invoices?.length || 0}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-muted">{roomRow.expenses?.length || 0}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-border p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-[13px] font-black uppercase text-text">Xu hướng lợi nhuận {year}</h3>
                <span className="text-[12px] font-semibold text-muted">12 tháng</span>
              </div>
              <div className="grid min-h-[140px] grid-cols-12 items-end gap-2">
                {(data.trend || []).map((item: any) => {
                  const height = Math.max(8, Math.round((Math.abs(Number(item.profit || 0)) / maxTrend) * 120));
                  const positive = Number(item.profit || 0) >= 0;
                  return (
                    <div key={item.month} className="flex flex-col items-center gap-2">
                      <div
                        className={`w-full rounded-t-lg ${positive ? "bg-emerald-400" : "bg-rose-400"}`}
                        style={{ height }}
                        title={`${formatVnd(item.profit)} lợi nhuận`}
                      />
                      <span className="text-[10px] font-bold text-muted">T{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border">
              <div className="border-b border-border bg-surface px-4 py-3">
                <h3 className="text-[13px] font-black uppercase text-text">Chi phí trong kỳ</h3>
              </div>
              <div className="max-h-[320px] overflow-auto">
                {(data.expenses || []).length === 0 ? (
                  <div className="p-6 text-center text-[13px] font-semibold text-muted">Không có chi phí trong kỳ.</div>
                ) : (
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="sticky top-0 bg-surface text-[11px] uppercase text-muted">
                      <tr>
                        <th className="px-4 py-3 font-black">Mã</th>
                        <th className="px-4 py-3 font-black">Tòa / phòng</th>
                        <th className="px-4 py-3 font-black">Loại</th>
                        <th className="px-4 py-3 font-black">Người chi</th>
                        <th className="px-4 py-3 text-right font-black">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.expenses || []).map((expense: any) => (
                        <tr key={expense.id} className="border-t border-border">
                          <td className="px-4 py-3 font-black text-text">{expense.code}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-text">{expense.building?.code || expense.costCenter?.code || "-"}</div>
                            <div className="text-[12px] text-muted">{expense.room?.code || "Theo tòa"}</div>
                          </td>
                          <td className="px-4 py-3 text-muted">{categoryLabels[expense.category] || expense.category}</td>
                          <td className="px-4 py-3 text-muted">{expense.paidByOwner?.name || expense.paidByName || "-"}</td>
                          <td className="px-4 py-3 text-right font-black text-text">{formatVnd(Number(expense.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "income" | "expense" }) {
  const isIncome = tone === "income";
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-muted">
        {isIncome ? <TrendingUp size={12} /> : <ReceiptText size={12} />}
        {label}
      </div>
      <div className={`mt-2 text-[15px] font-black ${isIncome ? "text-[#059669]" : "text-rose-500"}`}>{formatMoney(Number(value || 0))}</div>
    </div>
  );
}

function DetailMetric({ testId, label, value, tone }: { testId?: string; label: string; value: number; tone: "income" | "expense" }) {
  const isIncome = tone === "income";
  return (
    <div data-testid={testId} className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-[10px] font-black uppercase text-muted">{label}</div>
      <div className={`mt-2 text-[18px] font-black ${isIncome ? "text-[#059669]" : "text-rose-500"}`}>{formatVnd(Number(value || 0))}</div>
    </div>
  );
}
