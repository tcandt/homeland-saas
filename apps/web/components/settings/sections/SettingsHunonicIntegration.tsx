"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { Activity, Bolt, CalendarDays, CheckCircle2, Clock, Database, PlugZap, RefreshCcw, Search, Smartphone, Wifi } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { hunonicApi, HunonicSettingsPayload } from "@/lib/api/hunonic.api";

const fallback: Required<HunonicSettingsPayload> = {
  enabled: false,
  mode: "website",
  username: "",
  password: "",
  baseUrl: "https://api.hunonicpro.com/v2",
  websiteBaseUrl: "https://web.hunonic.com/api/api/hun-api",
  websiteToken: "",
  websiteCookie: "",
  timeoutMs: 15000,
  syncIntervalMinutes: 60,
  retentionYears: 3,
};

function formatMoney(value: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("vi-VN").format(number) + " đ";
}

function formatKwh(value: unknown) {
  const number = Number(value || 0);
  return `${number.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kWh`;
}

function formatDate(value?: string) {
  if (!value) return "Chưa đồng bộ";
  return new Date(value).toLocaleString("vi-VN");
}

function buildHunonicPayload(
  draft: Required<HunonicSettingsPayload>,
  secretTouched: { password: boolean; websiteToken: boolean; websiteCookie: boolean },
) {
  const payload: HunonicSettingsPayload = { ...draft };
  if (!secretTouched.password) delete payload.password;
  if (!secretTouched.websiteToken) delete payload.websiteToken;
  if (!secretTouched.websiteCookie) delete payload.websiteCookie;
  return payload;
}

export default function SettingsHunonicIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<Required<HunonicSettingsPayload>>("hunonic", "TENANT", fallback);
  const overview = useSWR(["hunonic-overview"], () => hunonicApi.overview(), { revalidateOnFocus: false });
  const rates = useSWR(["hunonic-rates"], () => hunonicApi.rates(), { revalidateOnFocus: false });
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isApplyingRate, setIsApplyingRate] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRateOpen, setIsRateOpen] = useState(false);
  const [isRateConfirmOpen, setIsRateConfirmOpen] = useState(false);
  const [selectedRateIds, setSelectedRateIds] = useState<string[]>([]);
  const [rateMode, setRateMode] = useState<"residential" | "custom">("residential");
  const [customRate, setCustomRate] = useState("");
  const [secretTouched, setSecretTouched] = useState({ password: false, websiteToken: false, websiteCookie: false });
  const [historyFilters, setHistoryFilters] = useState({
    search: "",
    buildingCode: "all",
    roomCode: "all",
    year: String(new Date().getFullYear()),
    month: "all",
    page: 1,
    limit: 25,
  });

  const meters = useMemo(() => ((overview.data as any)?.meters || []) as any[], [overview.data]);
  const rateRows = useMemo(() => ((rates.data as any)?.rows || []) as any[], [rates.data]);
  const rateSummary = (rates.data as any)?.summary || {};
  const residentialTemplate = ((rates.data as any)?.residentialTemplate || []) as any[];
  const summary = (overview.data as any)?.summary || {};
  const latestLog = (overview.data as any)?.latestLog;
  const history = useSWR(["hunonic-history", historyFilters], () => hunonicApi.history(historyFilters), {
    revalidateOnFocus: false,
  });
  const historyData = (history.data || {}) as any;
  const historyRooms = (historyData.filters?.rooms || []) as any[];
  const monthlyRows = (historyData.monthlyRows || []) as any[];
  const readingRows = (historyData.readings || []) as any[];
  const historySummary = historyData.summary || {};
  const pagination = historyData.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const result: any = await hunonicApi.test(buildHunonicPayload(draft, secretTouched));
      toast.success(`Kết nối Hunonic OK: ${result?.matchedMeters?.length || 0} công tơ khớp phòng`);
    } catch (error: any) {
      toast.error(error?.message || "Không kiểm tra được Hunonic");
    } finally {
      setIsTesting(false);
    }
  };

  const saveHunonic = async () => {
    await save(buildHunonicPayload(draft, secretTouched) as Required<HunonicSettingsPayload>);
    setSecretTouched({ password: false, websiteToken: false, websiteCookie: false });
  };

  const runSync = async () => {
    setIsSyncing(true);
    try {
      await hunonicApi.sync();
      await overview.mutate();
      await history.mutate();
      toast.success("Đã đồng bộ Hunonic");
    } catch (error: any) {
      toast.error(error?.message || "Không đồng bộ được Hunonic");
    } finally {
      setIsSyncing(false);
    }
  };

  const patchHistoryFilter = (patch: Partial<typeof historyFilters>) => {
    setHistoryFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));
  };

  const toggleRateRow = (id: string) => {
    setSelectedRateIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const toggleAllRateRows = () => {
    setSelectedRateIds((prev) => prev.length === rateRows.length ? [] : rateRows.map((row) => row.id));
  };

  const requestApplyRatePlan = () => {
    if (selectedRateIds.length === 0) {
      toast.error("Chọn ít nhất một công tơ");
      return;
    }
    if (rateMode === "custom" && (!customRate || Number(customRate) <= 0)) {
      toast.error("Nhập giá điện tùy chỉnh hợp lệ");
      return;
    }
    setIsRateConfirmOpen(true);
  };

  const applyRatePlan = async () => {
    setIsRateConfirmOpen(false);
    setIsApplyingRate(true);
    try {
      const result: any = await hunonicApi.applyRates({
        meterIds: selectedRateIds,
        mode: rateMode,
        customRateVnd: rateMode === "custom" ? Number(customRate) : undefined,
      });
      await rates.mutate();
      await overview.mutate();
      if (result?.updated) {
        toast.success(`Đã cập nhật ${result.updated} công tơ Hunonic`);
      }
      if (result?.failed) {
        const firstError = result?.errors?.[0]?.message;
        toast.error(firstError ? `${result.failed} công tơ lỗi: ${firstError}` : `${result.failed} công tơ chưa cập nhật được`);
      }
      if (!result?.updated && !result?.failed) {
        toast.error("Không có công tơ nào được cập nhật");
      }
    } catch (error: any) {
      toast.error(error?.message || "Không áp dụng được giá điện Hunonic");
    } finally {
      setIsApplyingRate(false);
    }
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="p-[20px] flex flex-col gap-[18px] border-[#22c55e]/20">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-[16px]">
          <div>
            <div className="flex items-center gap-[8px] text-[#16a34a] text-[12px] font-black uppercase tracking-[0.16em]">
              <PlugZap size={14} /> Hunonic electricity
            </div>
            <h3 className="mt-[8px] text-[18px] font-black text-text">Đồng bộ công tơ điện LK01-31 và LK01-32</h3>
            <p className="mt-[6px] text-[13px] text-muted max-w-[820px]">
              Dữ liệu được map cố định theo tên công tơ Hunonic: ĐIỆN 31.xx, ĐIỆN 32.xx và Văn Phòng. Job đồng bộ chạy mỗi 1 giờ khi tích hợp được bật.
            </p>
          </div>
          <div className="flex items-center gap-[10px] rounded-full border border-border px-[12px] py-[8px] bg-background w-fit">
            <span className="text-[12px] font-bold text-muted">Bật đồng bộ</span>
            <Switch checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-[12px]">
          <div className="rounded-[14px] border border-border bg-background p-[14px]">
            <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted"><Bolt size={14} /> Công tơ</div>
            <div className="mt-[6px] text-[22px] font-black text-text">{summary.mappings || 0}</div>
          </div>
          <div className="rounded-[14px] border border-border bg-background p-[14px]">
            <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted"><Wifi size={14} /> Đang ON</div>
            <div className="mt-[6px] text-[22px] font-black text-text">{summary.online || 0}</div>
          </div>
          <div className="rounded-[14px] border border-border bg-background p-[14px]">
            <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted"><Activity size={14} /> Tháng này</div>
            <div className="mt-[6px] text-[22px] font-black text-text">{formatKwh(summary.totalEnergyMonthKwh)}</div>
          </div>
          <div className="rounded-[14px] border border-border bg-background p-[14px]">
            <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted"><Database size={14} /> Lưu trữ</div>
            <div className="mt-[6px] text-[22px] font-black text-text">{draft.retentionYears} năm</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[16px]">
          <div className="flex flex-col gap-[10px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Chế độ API</label>
            <div className="grid grid-cols-2 gap-[8px]">
              {(["website", "mobile"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, mode }))}
                  className={`h-[42px] rounded-[12px] border text-[13px] font-black flex items-center justify-center gap-[8px] ${draft.mode === mode ? "bg-primary text-white border-primary" : "bg-background text-text border-border"}`}
                >
                  {mode === "website" ? <Wifi size={14} /> : <Smartphone size={14} />}
                  {mode === "website" ? "Website" : "Mobile"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-[12px]">
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Sync</label>
              <Input value={String(draft.syncIntervalMinutes)} disabled />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Timeout ms</label>
              <Input value={String(draft.timeoutMs)} onChange={(event) => setDraft((prev) => ({ ...prev, timeoutMs: Number(event.target.value) || 15000 }))} />
            </div>
          </div>
        </div>

        {draft.mode === "website" ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-[16px]">
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Website base URL</label>
              <Input value={draft.websiteBaseUrl ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, websiteBaseUrl: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Bearer token</label>
              <Input type="password" value={draft.websiteToken ?? ""} onChange={(event) => {
                setSecretTouched((prev) => ({ ...prev, websiteToken: true }));
                setDraft((prev) => ({ ...prev, websiteToken: event.target.value }));
              }} />
            </div>
            <div className="xl:col-span-2 flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Cookie header</label>
              <Input type="password" value={draft.websiteCookie ?? ""} onChange={(event) => {
                setSecretTouched((prev) => ({ ...prev, websiteCookie: true }));
                setDraft((prev) => ({ ...prev, websiteCookie: event.target.value }));
              }} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-[16px]">
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Mobile base URL</label>
              <Input value={draft.baseUrl ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))} />
              <p className="text-[11px] font-semibold text-muted">Co the nhap domain goc, backend se tu dung /v2 cho api.hunonicpro.com.</p>
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Tài khoản</label>
              <Input value={draft.username ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, username: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Mật khẩu</label>
              <Input type="password" value={draft.password ?? ""} onChange={(event) => {
                setSecretTouched((prev) => ({ ...prev, password: true }));
                setDraft((prev) => ({ ...prev, password: event.target.value }));
              }} />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[12px]">
          <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
            <Clock size={14} />
            Lần sync gần nhất: {formatDate(latestLog?.finishedAt || latestLog?.startedAt)}
          </div>
          <div className="flex flex-col sm:flex-row gap-[10px]">
            <Button type="button" variant="outline" onClick={testConnection} isLoading={isTesting} className="h-[42px]">
              Kiểm tra kết nối
            </Button>
            <Button type="button" variant="outline" onClick={runSync} isLoading={isSyncing} className="h-[42px]">
              <RefreshCcw size={14} className="mr-2" /> Sync ngay
            </Button>
            <Button type="button" onClick={saveHunonic} isLoading={isSaving} className="h-[42px] bg-primary text-white">
              Lưu Hunonic
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-border/70 bg-card/95">
        <div className="flex flex-col gap-[16px] p-[18px]">
          <div>
            <h3 className="text-[15px] font-black text-text">Kiểm tra sync data 3 năm</h3>
            <p className="text-[12px] text-muted mt-[3px] max-w-[760px]">
              Bảng lịch sử được đưa vào popup để tránh kéo dài trang cài đặt. Có thể lọc theo phòng, tòa, tháng/năm và xem log chi tiết.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-[10px] min-[1120px]:grid-cols-4">
              <div className="min-w-0 rounded-[14px] border border-border/70 bg-background/80 p-[12px]">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Bản ghi</div>
                <div className="mt-1 truncate text-[18px] font-black text-text">{historySummary.totalReadings || 0}</div>
              </div>
              <div className="min-w-0 rounded-[14px] border border-border/70 bg-background/80 p-[12px]">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Phòng/tháng</div>
                <div className="mt-1 truncate text-[18px] font-black text-text">{historySummary.monthlyRows || 0}</div>
              </div>
              <div className="min-w-0 rounded-[14px] border border-border/70 bg-background/80 p-[12px]">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">kWh</div>
                <div className="mt-1 truncate text-[18px] font-black text-text">{formatKwh(historySummary.totalEnergyMonthKwh)}</div>
              </div>
              <div className="min-w-0 rounded-[14px] border border-border/70 bg-background/80 p-[12px]">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tiền</div>
                <div className="mt-1 truncate text-[18px] font-black text-[#16a34a]">{formatMoney(historySummary.totalMoneyMonthVnd)}</div>
              </div>
          </div>
          <div className="flex justify-end border-t border-border/70 pt-[14px]">
            <Button type="button" onClick={() => setIsHistoryOpen(true)} className="h-[42px] min-w-[180px] bg-primary text-white whitespace-nowrap">
              Mở bảng kiểm tra
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-border/70 bg-card/95">
        <div className="flex flex-col gap-[16px] p-[18px]">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#16a34a]">HUNONIC ELECTRICITY RATE</div>
            <h3 className="mt-[4px] text-[16px] font-black text-text">Thiết lập giá điện theo công tơ</h3>
            <p className="text-[12px] text-muted mt-[4px] max-w-[780px]">
              Chọn một hoặc nhiều công tơ để thiết lập mức sinh hoạt EVN hoặc giá tùy chỉnh. Bảng chi tiết được đặt trong popup để trang cài đặt gọn hơn.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-[10px]">
            <div className="min-w-0 rounded-[14px] border border-border/70 bg-background/80 p-[12px] text-center">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">Công tơ</div>
              <div className="mt-1 text-[18px] font-black text-text">{rateSummary.totalMeters || 0}</div>
            </div>
            <div className="min-w-0 rounded-[14px] border border-border/70 bg-background/80 p-[12px] text-center">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">EVN</div>
              <div className="mt-1 text-[18px] font-black text-text">{rateSummary.residentialMeters || 0}</div>
            </div>
            <div className="min-w-0 rounded-[14px] border border-border/70 bg-background/80 p-[12px] text-center">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tùy chỉnh</div>
              <div className="mt-1 text-[18px] font-black text-text">{rateSummary.customMeters || 0}</div>
            </div>
          </div>
          <div className="flex justify-end border-t border-border/70 pt-[14px]">
            <Button type="button" onClick={() => setIsRateOpen(true)} className="h-[42px] min-w-[180px] bg-primary text-white whitespace-nowrap">
              Mở thiết lập giá
            </Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={isRateOpen} onClose={() => setIsRateOpen(false)} title="Thiết lập giá điện Hunonic" maxWidth="max-w-[min(1180px,92vw)]">
      <div className="-m-5 mx-auto flex max-h-[calc(86vh-40px)] max-w-full flex-col overflow-hidden rounded-[16px] border border-border bg-card">
        <div className="p-[16px] border-b border-border flex flex-col xl:flex-row xl:items-center justify-between gap-[14px]">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#16a34a]">HUNONIC ELECTRICITY RATE</div>
            <h3 className="mt-[4px] text-[16px] font-black text-text">Chọn công tơ và mức giá cần áp dụng</h3>
            <p className="text-[12px] text-muted mt-[4px] max-w-[820px]">
              Dữ liệu bảng giá được đọc trực tiếp từ Hunonic. Khi bật ghi giá thật, hệ thống sẽ yêu cầu xác nhận trước khi cập nhật lên Hunonic.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-[8px] min-w-0 xl:min-w-[360px]">
            <div className="rounded-[12px] border border-border bg-background p-[10px] text-center">
              <div className="text-[10px] font-black uppercase text-muted">Công tơ</div>
              <div className="text-[18px] font-black text-text">{rateSummary.totalMeters || 0}</div>
            </div>
            <div className="rounded-[12px] border border-border bg-background p-[10px] text-center">
              <div className="text-[10px] font-black uppercase text-muted">EVN</div>
              <div className="text-[18px] font-black text-text">{rateSummary.residentialMeters || 0}</div>
            </div>
            <div className="rounded-[12px] border border-border bg-background p-[10px] text-center">
              <div className="text-[10px] font-black uppercase text-muted">Tùy chỉnh</div>
              <div className="text-[18px] font-black text-text">{rateSummary.customMeters || 0}</div>
            </div>
          </div>
        </div>

        <div className="p-[14px] border-b border-border bg-background/70 grid grid-cols-1 xl:grid-cols-[1fr_220px_180px_180px] gap-[10px]">
          <div className="grid grid-cols-2 gap-[8px]">
            <button type="button" onClick={() => setRateMode("residential")} className={`h-[42px] rounded-[12px] border text-[13px] font-black ${rateMode === "residential" ? "bg-primary text-white border-primary" : "bg-card text-text border-border"}`}>
              Mức sinh hoạt EVN
            </button>
            <button type="button" onClick={() => setRateMode("custom")} className={`h-[42px] rounded-[12px] border text-[13px] font-black ${rateMode === "custom" ? "bg-primary text-white border-primary" : "bg-card text-text border-border"}`}>
              Tự thiết lập
            </button>
          </div>
          <Input type="number" min="1" value={customRate} onChange={(event) => setCustomRate(event.target.value)} disabled={rateMode !== "custom"} placeholder="Giá đ/kWh" className="h-[42px]" />
          <Button type="button" variant="outline" onClick={toggleAllRateRows} className="h-[42px]">
            {selectedRateIds.length === rateRows.length && rateRows.length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </Button>
          <Button type="button" onClick={requestApplyRatePlan} isLoading={isApplyingRate} className="h-[42px] bg-primary text-white">
            Áp dụng {selectedRateIds.length ? `(${selectedRateIds.length})` : ""}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[980px] table-fixed text-[13px]">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="w-[56px] text-center py-[11px] px-[10px] text-[10px] uppercase tracking-wide text-muted font-black">Chọn</th>
                <th className="w-[170px] text-center py-[11px] px-[10px] text-[10px] uppercase tracking-wide text-muted font-black">Phòng</th>
                <th className="w-[150px] text-center py-[11px] px-[10px] text-[10px] uppercase tracking-wide text-muted font-black">Công tơ</th>
                <th className="w-[140px] text-center py-[11px] px-[10px] text-[10px] uppercase tracking-wide text-muted font-black">Chế độ hiện tại</th>
                <th className="w-[130px] text-center py-[11px] px-[10px] text-[10px] uppercase tracking-wide text-muted font-black">Giá tùy chỉnh</th>
                <th className="w-[260px] text-center py-[11px] px-[10px] text-[10px] uppercase tracking-wide text-muted font-black">Bậc EVN</th>
                <th className="w-[150px] text-center py-[11px] px-[10px] text-[10px] uppercase tracking-wide text-muted font-black">Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {rates.isLoading ? (
                <tr><td colSpan={7} className="py-[30px] px-[14px] text-center text-muted font-medium">Đang đọc bảng giá từ Hunonic...</td></tr>
              ) : rateRows.length === 0 ? (
                <tr><td colSpan={7} className="py-[30px] px-[14px] text-center text-muted font-medium">Chưa có công tơ để đọc bảng giá.</td></tr>
              ) : rateRows.map((row) => {
                const isSelected = selectedRateIds.includes(row.id);
                const previewMode = isSelected ? rateMode : row.currentMode;
                const previewCustomRate = isSelected && rateMode === "custom" ? Number(customRate) : row.customRateVnd;

                return (
                <tr
                  key={row.id}
                  onClick={() => toggleRateRow(row.id)}
                  className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-background/70 ${isSelected ? "bg-primary/5" : ""}`}
                >
                  <td className="h-[54px] text-center align-middle">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleRateRow(row.id)}
                      className="h-[16px] w-[16px] accent-primary"
                    />
                  </td>
                  <td className="h-[54px] py-[10px] px-[10px] text-center align-middle font-black text-text whitespace-nowrap">{row.buildingCode} / {row.displayName}</td>
                  <td className="h-[54px] py-[10px] px-[10px] text-center align-middle text-muted whitespace-nowrap truncate">{row.deviceName}</td>
                  <td className="h-[54px] py-[10px] px-[10px] text-center align-middle">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${previewMode === "custom" ? "bg-amber-500/10 text-amber-700" : previewMode === "residential" ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-600"}`}>
                      {previewMode === "custom" ? "Tự thiết lập" : previewMode === "residential" ? "Sinh hoạt EVN" : "Lỗi đọc"}
                    </span>
                  </td>
                  <td className="h-[54px] py-[10px] px-[10px] text-center align-middle font-black text-text whitespace-nowrap">
                    {previewMode === "custom" && previewCustomRate ? formatMoney(previewCustomRate) : "--"}
                  </td>
                  <td className="h-[54px] py-[10px] px-[10px] text-center align-middle text-muted">
                    {row.residentialSteps?.length ? (
                      <span className="line-clamp-1">{row.residentialSteps.slice(0, 3).map((step: any) => `${step.minRate}-${step.maxRate}kWh: ${Number(step.price || 0).toLocaleString("vi-VN")}d`).join(" | ")}</span>
                    ) : row.error ? <span className="text-rose-600">{row.error}</span> : "--"}
                  </td>
                  <td className="h-[54px] py-[10px] px-[10px] text-center align-middle text-muted whitespace-nowrap">{formatDate(row.lastSyncedAt)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {residentialTemplate.length > 0 && (
          <div className="p-[14px] bg-background/60 border-t border-border text-[12px] text-muted">
            Mẫu EVN: {residentialTemplate.map((step: any) => `${step.minRate}-${step.maxRate} kWh ${Number(step.price || 0).toLocaleString("vi-VN")} đ`).join(" | ")}
          </div>
        )}
      </div>
      </Modal>

      <Modal
        isOpen={isRateConfirmOpen}
        onClose={() => setIsRateConfirmOpen(false)}
        title="Xác nhận áp dụng giá điện"
        maxWidth="max-w-[520px]"
        zIndex={10060}
        footer={
          <div className="flex flex-col-reverse gap-[10px] sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsRateConfirmOpen(false)} disabled={isApplyingRate} className="h-[42px] min-w-[112px]">
              Hủy
            </Button>
            <Button type="button" onClick={applyRatePlan} isLoading={isApplyingRate} className="h-[42px] min-w-[170px] bg-primary text-white">
              Xác nhận áp dụng
            </Button>
          </div>
        }
      >
        <div className="space-y-[16px]">
          <div className="flex items-start gap-[12px] rounded-[16px] border border-[#22c55e]/20 bg-[#22c55e]/5 p-[14px]">
            <div className="mt-[2px] flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#22c55e]/10 text-[#16a34a]">
              <CheckCircle2 size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-black text-text">Cập nhật trực tiếp lên Hunonic</div>
              <p className="mt-[4px] text-[13px] font-semibold leading-6 text-muted">
                Hệ thống sẽ ghi cấu hình giá cho các công tơ đã chọn và làm mới bảng sau khi Hunonic phản hồi.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[16px] border border-border bg-background/70">
            <div className="grid grid-cols-[140px_1fr] items-center border-b border-border/70 px-[14px] py-[12px]">
              <div className="text-[11px] font-black uppercase tracking-wide text-muted">Số công tơ</div>
              <div className="text-right text-[16px] font-black text-text">{selectedRateIds.length}</div>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center border-b border-border/70 px-[14px] py-[12px]">
              <div className="text-[11px] font-black uppercase tracking-wide text-muted">Chế độ</div>
              <div className="text-right text-[14px] font-black text-text">{rateMode === "custom" ? "Tự thiết lập" : "Sinh hoạt EVN"}</div>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center px-[14px] py-[12px]">
              <div className="text-[11px] font-black uppercase tracking-wide text-muted">Giá áp dụng</div>
              <div className="text-right text-[16px] font-black text-text">
                {rateMode === "custom" ? `${Number(customRate).toLocaleString("vi-VN")} đ/kWh` : "Theo bậc sinh hoạt EVN"}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Card className="hidden">
        <div className="p-[16px] border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-black text-text">Bảng công tơ đã map</h3>
            <p className="text-[12px] text-muted mt-[3px]">Chỉ hiển thị LK01-31 và LK01-32 trong giai đoạn này.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="text-left py-[10px] px-[14px] text-[10px] uppercase tracking-wide text-muted font-black">Phòng</th>
                <th className="text-left py-[10px] px-[14px] text-[10px] uppercase tracking-wide text-muted font-black">Công tơ</th>
                <th className="text-right py-[10px] px-[14px] text-[10px] uppercase tracking-wide text-muted font-black">kWh tháng</th>
                <th className="text-right py-[10px] px-[14px] text-[10px] uppercase tracking-wide text-muted font-black">Tiền điện</th>
                <th className="text-left py-[10px] px-[14px] text-[10px] uppercase tracking-wide text-muted font-black">Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {meters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-[34px] px-[14px] text-center text-muted font-medium">
                    Chưa có dữ liệu Hunonic. Hãy lưu cấu hình rồi chạy Sync ngay.
                  </td>
                </tr>
              ) : meters.map((meter) => (
                <tr key={meter.id} className="border-b border-border/60">
                  <td className="py-[12px] px-[14px] font-black text-text">{meter.buildingCode} / {meter.displayName}</td>
                  <td className="py-[12px] px-[14px] text-muted">{meter.deviceName}</td>
                  <td className="py-[12px] px-[14px] text-right font-bold text-text">{formatKwh(meter.energyMonthKwh)}</td>
                  <td className="py-[12px] px-[14px] text-right font-black text-[#16a34a]">{formatMoney(meter.moneyMonthVnd)}</td>
                  <td className="py-[12px] px-[14px] text-muted">{formatDate(meter.lastSyncedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="Kiểm tra sync data 3 năm" maxWidth="max-w-[min(1520px,96vw)]">
      <div className="-m-5 overflow-hidden rounded-[16px] border border-border bg-card">
        <div className="p-[16px] border-b border-border flex flex-col gap-[14px]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-[12px]">
            <div>
              <h3 className="text-[15px] font-black text-text">Kiểm tra sync data 3 năm</h3>
              <p className="text-[12px] text-muted mt-[3px]">
                Lọc chỉ số kWh và tiền điện theo phòng, tháng, năm. Tổng hợp tháng dùng bản ghi mới nhất của từng phòng để tránh cộng lặp các lần sync theo giờ.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] min-w-0 xl:min-w-[620px]">
              <div className="rounded-[12px] border border-border bg-background p-[12px]">
                <div className="text-[10px] font-black uppercase text-muted">Bản ghi</div>
                <div className="mt-1 text-[18px] font-black text-text">{historySummary.totalReadings || 0}</div>
              </div>
              <div className="rounded-[12px] border border-border bg-background p-[12px]">
                <div className="text-[10px] font-black uppercase text-muted">Phòng/tháng</div>
                <div className="mt-1 text-[18px] font-black text-text">{historySummary.monthlyRows || 0}</div>
              </div>
              <div className="rounded-[12px] border border-border bg-background p-[12px]">
                <div className="text-[10px] font-black uppercase text-muted">kWh</div>
                <div className="mt-1 text-[18px] font-black text-text">{formatKwh(historySummary.totalEnergyMonthKwh)}</div>
              </div>
              <div className="rounded-[12px] border border-border bg-background p-[12px]">
                <div className="text-[10px] font-black uppercase text-muted">Tiền</div>
                <div className="mt-1 text-[18px] font-black text-[#16a34a]">{formatMoney(historySummary.totalMoneyMonthVnd)}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1.3fr)_repeat(4,minmax(120px,0.7fr))] gap-[10px]">
            <div className="relative">
              <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
              <Input value={historyFilters.search} onChange={(event) => patchHistoryFilter({ search: event.target.value })} placeholder="Tìm phòng, công tơ..." className="pl-[34px]" />
            </div>
            <select value={historyFilters.buildingCode} onChange={(event) => patchHistoryFilter({ buildingCode: event.target.value, roomCode: "all" })} className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none">
              <option value="all">Tất cả tòa</option>
              <option value="LK01-31">LK01-31</option>
              <option value="LK01-32">LK01-32</option>
            </select>
            <select value={historyFilters.roomCode} onChange={(event) => patchHistoryFilter({ roomCode: event.target.value })} className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none">
              <option value="all">Tất cả phòng</option>
              {historyRooms
                .filter((room) => historyFilters.buildingCode === "all" || room.buildingCode === historyFilters.buildingCode)
                .map((room) => (
                  <option key={`${room.buildingCode}-${room.roomCode}`} value={room.roomCode}>
                    {room.buildingCode} / {room.displayName}
                  </option>
                ))}
            </select>
            <select value={historyFilters.year} onChange={(event) => patchHistoryFilter({ year: event.target.value })} className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none">
              <option value="all">3 năm gần nhất</option>
              {(historyData.filters?.availableYears || [new Date().getFullYear()]).map((year: number) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
            <select value={historyFilters.month} onChange={(event) => patchHistoryFilter({ month: event.target.value })} className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none">
              <option value="all">Cả năm</option>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={String(month)}>Tháng {month}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-[16px] border-b border-border">
          <div className="mb-[10px] flex items-center gap-[8px] text-[12px] font-black uppercase tracking-wide text-muted">
            <CalendarDays size={14} /> Tổng hợp theo tháng/năm
          </div>
          <div className="overflow-x-auto rounded-[14px] border border-border">
            <table className="w-full min-w-[920px] table-fixed text-[13px]">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="w-[110px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Kỳ</th>
                  <th className="w-[190px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Phòng</th>
                  <th className="w-[160px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Công tơ</th>
                  <th className="w-[130px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Công suất</th>
                  <th className="w-[140px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">kWh tháng</th>
                  <th className="w-[150px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Tiền điện</th>
                  <th className="w-[170px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Mốc đọc</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-[28px] px-[14px] text-center text-muted font-medium">Chưa có dữ liệu phù hợp bộ lọc.</td>
                  </tr>
                ) : monthlyRows.map((row) => (
                  <tr key={`${row.buildingCode}-${row.roomCode}-${row.period}`} className="border-b border-border/60 hover:bg-background/60">
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle font-black text-text whitespace-nowrap">{row.period}</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle font-black text-text whitespace-nowrap">{row.buildingCode} / {row.displayName}</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle text-muted whitespace-nowrap truncate">{row.deviceName}</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle font-bold text-text whitespace-nowrap">{Number(row.powerCurrentW || 0).toLocaleString("vi-VN")} W</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle font-bold text-text whitespace-nowrap">{formatKwh(row.energyMonthKwh)}</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle font-black text-[#16a34a] whitespace-nowrap">{formatMoney(row.moneyMonthVnd)}</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle text-muted whitespace-nowrap">{formatDate(row.readingAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-[16px]">
          <div className="mb-[10px] flex items-center justify-between gap-[12px]">
            <div className="flex items-center gap-[8px] text-[12px] font-black uppercase tracking-wide text-muted">
              <Database size={14} /> Log sync chi tiết
            </div>
            <div className="text-[12px] font-bold text-muted">Trang {pagination.page} / {pagination.totalPages}</div>
          </div>
          <div className="overflow-x-auto rounded-[14px] border border-border">
            <table className="w-full min-w-[980px] table-fixed text-[13px]">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="w-[170px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Thời điểm</th>
                  <th className="w-[190px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Phòng</th>
                  <th className="w-[150px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Công tơ</th>
                  <th className="w-[110px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Trạng thái</th>
                  <th className="w-[130px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Công suất</th>
                  <th className="w-[140px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">kWh tháng</th>
                  <th className="w-[150px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Tiền tháng</th>
                  <th className="w-[160px] text-center py-[12px] px-[12px] text-[10px] uppercase tracking-wide text-muted font-black align-middle">Tiền tháng trước</th>
                </tr>
              </thead>
              <tbody>
                {readingRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-[28px] px-[14px] text-center text-muted font-medium">Chưa có log sync phù hợp bộ lọc.</td>
                  </tr>
                ) : readingRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 hover:bg-background/60">
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle text-muted whitespace-nowrap">{formatDate(row.readingAt)}</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle font-black text-text whitespace-nowrap">{row.buildingCode} / {row.displayName}</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle text-muted whitespace-nowrap truncate">{row.deviceName}</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-black ${row.status === "on" ? "bg-emerald-500/10 text-emerald-700" : "bg-slate-500/10 text-slate-600"}`}>{row.status || "unknown"}</span>
                    </td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle font-bold text-text whitespace-nowrap">{Number(row.powerCurrentW || 0).toLocaleString("vi-VN")} W</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle font-bold text-text whitespace-nowrap">{formatKwh(row.energyMonthKwh)}</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle font-black text-[#16a34a] whitespace-nowrap">{formatMoney(row.moneyMonthVnd)}</td>
                    <td className="h-[48px] py-[10px] px-[12px] text-center align-middle font-bold text-muted whitespace-nowrap">{formatMoney(row.moneyPrevMonthVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-[14px] flex flex-col sm:flex-row sm:items-center justify-between gap-[10px]">
            <div className="text-[12px] font-bold text-muted">{pagination.total} bản ghi, hiển thị {readingRows.length} bản ghi/trang</div>
            <div className="flex items-center gap-[8px]">
              <Button type="button" variant="outline" disabled={pagination.page <= 1 || history.isLoading} onClick={() => patchHistoryFilter({ page: Math.max(1, pagination.page - 1) })} className="h-[36px]">Trước</Button>
              <Button type="button" variant="outline" disabled={pagination.page >= pagination.totalPages || history.isLoading} onClick={() => patchHistoryFilter({ page: pagination.page + 1 })} className="h-[36px]">Sau</Button>
            </div>
          </div>
        </div>
      </div>
      </Modal>
    </div>
  );
}
