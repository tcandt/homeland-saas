"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import {
  Activity,
  Bolt,
  CalendarDays,
  CheckCircle2,
  Clock,
  Database,
  PlugZap,
  RefreshCcw,
  Search,
  Shield,
  Smartphone,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  hunonicApi,
  HunonicLockedPeriodRow,
  HunonicSettingsPayload,
} from "@/lib/api/hunonic.api";

const fallback: Required<HunonicSettingsPayload> = {
  enabled: false,
  mode: "website",
  username: "",
  password: "",
  passwordConfigured: false,
  baseUrl: "https://api.hunonicpro.com/v2",
  websiteBaseUrl: "https://web.hunonic.com/api/api/hun-api",
  websiteToken: "",
  websiteTokenConfigured: false,
  websiteCookie: "",
  websiteCookieConfigured: false,
  timeoutMs: 15000,
  syncIntervalMinutes: 60,
  retentionYears: 3,
};

function canonicalBuildingCode(value: unknown) {
  return String(value || "").trim().replace(/\./g, "-");
}

function roomIdentity(buildingCode: unknown, roomCode: unknown) {
  return `${canonicalBuildingCode(buildingCode)}::${String(roomCode || "").trim()}`;
}

function formatMoney(value: unknown) {
  const number = Number(value || 0);
  return `${new Intl.NumberFormat("vi-VN").format(number)} đ`;
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
  delete payload.passwordConfigured;
  delete payload.websiteTokenConfigured;
  delete payload.websiteCookieConfigured;
  if (!secretTouched.password) delete payload.password;
  if (!secretTouched.websiteToken) delete payload.websiteToken;
  if (!secretTouched.websiteCookie) delete payload.websiteCookie;
  return payload;
}

function rowKey(row: { buildingCode: string; roomCode: string; period?: string }) {
  return `${row.buildingCode}:${row.roomCode}:${row.period || ""}`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function SettingsHunonicIntegration() {
  const user = useAuthStore((state) => state.user);
  const { draft, setDraft, isSaving, save } = useSettingsSection<Required<HunonicSettingsPayload>>(
    "hunonic",
    "TENANT",
    fallback,
  );

  const overview = useSWR(["hunonic-overview"], () => hunonicApi.overview(), { revalidateOnFocus: false });
  const rates = useSWR(["hunonic-rates"], () => hunonicApi.rates(), { revalidateOnFocus: false });

  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isApplyingRate, setIsApplyingRate] = useState(false);
  const [isLockingHistory, setIsLockingHistory] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRateOpen, setIsRateOpen] = useState(false);
  const [isRateConfirmOpen, setIsRateConfirmOpen] = useState(false);
  const [selectedRateIds, setSelectedRateIds] = useState<string[]>([]);
  const [selectedMonthlyKeys, setSelectedMonthlyKeys] = useState<string[]>([]);
  const [rateMode, setRateMode] = useState<"residential" | "custom">("residential");
  const [customRate, setCustomRate] = useState("");
  const [secretTouched, setSecretTouched] = useState({
    password: false,
    websiteToken: false,
    websiteCookie: false,
  });
  const [historyFilters, setHistoryFilters] = useState({
    search: "",
    buildingCode: "all",
    roomCode: "all",
    year: String(new Date().getFullYear()),
    month: "all",
    page: 1,
    limit: 25,
  });

  const history = useSWR(["hunonic-history", historyFilters], () => hunonicApi.history(historyFilters), {
    revalidateOnFocus: false,
  });
  const reconciliation = useSWR(
    ["hunonic-reconciliation", historyFilters],
    () => hunonicApi.reconciliation(historyFilters),
    { revalidateOnFocus: false },
  );

  const summary = (overview.data as any)?.summary || {};
  const latestLog = (overview.data as any)?.latestLog;
  const rateRows = useMemo(() => ((rates.data as any)?.rows || []) as any[], [rates.data]);
  const rateSummary = (rates.data as any)?.summary || {};
  const residentialTemplate = ((rates.data as any)?.residentialTemplate || []) as any[];

  const historyData = (history.data || {}) as any;
  const historySummary = historyData.summary || {};
  const dataQuality = historySummary.dataQuality || { duplicatePeriods: 0, abnormalPeriods: 0, missingPeriods: 0, alerts: [] };
  const historyRooms = useMemo(() => {
    const rooms = ((historyData.filters?.rooms || []) as any[]);
    const seen = new Set<string>();
    return rooms.filter((room) => {
      const key = roomIdentity(room.buildingCode, room.roomCode);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [historyData.filters?.rooms]);
  const buildingOptions = useMemo(
    () => Array.from(new Set(historyRooms.map((room: any) => room.buildingCode).filter(Boolean))).sort(),
    [historyRooms],
  );
  const monthlyRows = (historyData.monthlyRows || []) as any[];
  const qualityAlerts = (historyData.qualityAlerts || []) as any[];
  const readingRows = (historyData.readings || []) as any[];
  const lockedPeriods = (historyData.filters?.lockedPeriods || []) as any[];
  const roomsWithData =
    historySummary.roomsWithData ??
    new Set(monthlyRows.map((row: any) => roomIdentity(row.buildingCode, row.roomCode))).size;
  const pagination = historyData.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 };

  const reconciliationData = (reconciliation.data || {}) as any;
  const reconciliationRows = (reconciliationData.rows || []) as any[];
  const reconciliationSummary = reconciliationData.summary || {};

  const selectedMonthlyRows = useMemo(
    () => monthlyRows.filter((row: any) => selectedMonthlyKeys.includes(rowKey(row))),
    [monthlyRows, selectedMonthlyKeys],
  );
  const allMonthlySelected = monthlyRows.length > 0 && selectedMonthlyKeys.length === monthlyRows.length;
  const allRateSelected = rateRows.length > 0 && selectedRateIds.length === rateRows.length;
  const canEditHunonicSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn";

  const patchHistoryFilter = (patch: Partial<typeof historyFilters>) => {
    setHistoryFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));
  };

  const mutateHistoryPanels = async () => {
    await Promise.all([overview.mutate(), history.mutate(), reconciliation.mutate()]);
  };

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
      await save(buildHunonicPayload(draft, secretTouched) as Required<HunonicSettingsPayload>);
      setSecretTouched({ password: false, websiteToken: false, websiteCookie: false });
      await hunonicApi.sync();
      await mutateHistoryPanels();
      toast.success("Đã đồng bộ Hunonic");
    } catch (error: any) {
      toast.error(error?.message || "Không đồng bộ được Hunonic");
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleRateRow = (id: string) => {
    setSelectedRateIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAllRateRows = () => {
    setSelectedRateIds((prev) => (prev.length === rateRows.length ? [] : rateRows.map((row) => row.id)));
  };

  const toggleMonthlyRow = (row: any) => {
    const key = rowKey(row);
    setSelectedMonthlyKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const toggleAllMonthlyRows = () => {
    setSelectedMonthlyKeys((prev) => (prev.length === monthlyRows.length ? [] : monthlyRows.map(rowKey)));
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
      await Promise.all([rates.mutate(), overview.mutate()]);
      if (result?.updated) toast.success(`Đã cập nhật ${result.updated} công tơ Hunonic`);
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

  const applyHistoryLock = async (mode: "lock" | "unlock", rows: any[]) => {
    const payload: HunonicLockedPeriodRow[] = rows.map((row) => ({
      buildingCode: row.buildingCode,
      roomCode: row.roomCode,
      period: row.period,
    }));
    if (payload.length === 0) {
      toast.error("Chọn ít nhất một kỳ điện");
      return;
    }

    setIsLockingHistory(true);
    try {
      if (mode === "lock") {
        await hunonicApi.lockPeriods(payload);
        toast.success(`Đã khóa ${payload.length} kỳ điện`);
      } else {
        await hunonicApi.unlockPeriods(payload);
        toast.success(`Đã mở khóa ${payload.length} kỳ điện`);
      }
      setSelectedMonthlyKeys([]);
      await mutateHistoryPanels();
    } catch (error: any) {
      toast.error(error?.message || (mode === "lock" ? "Không khóa được kỳ điện" : "Không mở khóa được kỳ điện"));
    } finally {
      setIsLockingHistory(false);
    }
  };

  const exportHistoryCsv = () => {
    if (monthlyRows.length === 0) {
      toast.error("Chưa có dữ liệu để export");
      return;
    }

    const header = [
      "Ky",
      "Toa",
      "Phong",
      "Cong to",
      "Cong suat W",
      "kWh thang",
      "Tien dien VND",
      "Khoa ky",
      "So ban ghi trung",
      "Moc doc",
    ];

    const lines = [
      header.join(","),
      ...monthlyRows.map((row: any) =>
        [
          csvEscape(row.period),
          csvEscape(row.buildingCode),
          csvEscape(row.displayName),
          csvEscape(row.deviceName),
          csvEscape(Number(row.powerCurrentW || 0)),
          csvEscape(Number(row.energyMonthKwh || 0)),
          csvEscape(Number(row.moneyMonthVnd || 0)),
          csvEscape(row.isLocked ? "locked" : "open"),
          csvEscape(Number(row.duplicateReadings || 1)),
          csvEscape(formatDate(row.readingAt)),
        ].join(","),
      ),
    ];

    const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hunonic-history-${historyFilters.buildingCode}-${historyFilters.roomCode}-${historyFilters.year}-${historyFilters.month}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Đã export lịch sử điện");
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="border border-[#22c55e]/15 bg-card/95 p-[20px]">
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-[16px] xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-[860px]">
              <div className="flex items-center gap-[8px] text-[12px] font-black uppercase tracking-[0.16em] text-[#16a34a]">
                <PlugZap size={14} />
                Điện Hunonic
              </div>
              <h3 className="mt-[8px] text-[20px] font-black text-text">Đồng bộ công tơ điện theo các tòa đang quản lý</h3>
              <p className="mt-[6px] text-[13px] leading-6 text-muted">
                Dữ liệu được ghép theo mã phòng trong tên công tơ Hunonic, ví dụ ĐIỆN 31.xx hoặc ĐIỆN 32.xx. Phòng chưa có dữ liệu sẽ được bỏ qua và cập nhật ở lần đồng bộ sau.
              </p>
            </div>
            <div className="flex w-fit items-center gap-[10px] rounded-full border border-border bg-background px-[12px] py-[8px]">
              <span className="text-[12px] font-bold text-muted">Đồng bộ</span>
              <Switch checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[12px] xl:grid-cols-5">
            <div className="rounded-[14px] border border-border bg-background p-[14px]">
              <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
                <Bolt size={14} />
                Công tơ
              </div>
              <div className="mt-[6px] text-[22px] font-black text-text">{summary.mappings || 0}</div>
            </div>
            <div className="rounded-[14px] border border-border bg-background p-[14px]">
              <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
                <Wifi size={14} />
                Đang bật
              </div>
              <div className="mt-[6px] text-[22px] font-black text-text">{summary.online || 0}</div>
            </div>
            <div className="rounded-[14px] border border-border bg-background p-[14px]">
              <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
                <Activity size={14} />
                Tháng này
              </div>
              <div className="mt-[6px] text-[22px] font-black text-text">{formatKwh(summary.totalEnergyMonthKwh)}</div>
            </div>
            <div className="rounded-[14px] border border-border bg-background p-[14px]">
              <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
                <Database size={14} />
                Lưu trữ
              </div>
              <div className="mt-[6px] text-[22px] font-black text-text">{draft.retentionYears} năm</div>
            </div>
            <div className="rounded-[14px] border border-border bg-background p-[14px]">
              <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
                <Shield size={14} />
                Kỳ đã khóa
              </div>
              <div className="mt-[6px] text-[22px] font-black text-text">{lockedPeriods.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-2">
            <div className="flex flex-col gap-[10px]">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Chế độ API</label>
              <div className="grid grid-cols-2 gap-[8px]">
                {(["website", "mobile"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, mode }))}
                    className={`flex h-[42px] items-center justify-center gap-[8px] rounded-[12px] border text-[13px] font-black ${draft.mode === mode ? "border-primary bg-primary text-white" : "border-border bg-background text-text"
                      }`}
                  >
                    {mode === "website" ? <Wifi size={14} /> : <Smartphone size={14} />}
                    {mode === "website" ? "Website" : "Mobile"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[12px]">
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Chu kỳ đồng bộ</label>
                <Input value={String(draft.syncIntervalMinutes ?? 60)} disabled />
              </div>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Thời gian chờ (ms)</label>
                <Input
                  value={String(draft.timeoutMs ?? 15000)}
                  onChange={(event) => setDraft((prev) => ({ ...prev, timeoutMs: Number(event.target.value) || 15000 }))}
                />
              </div>
            </div>
          </div>

          {draft.mode === "website" ? (
            <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-2">
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">URL nền tảng web</label>
                <Input value={draft.websiteBaseUrl ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, websiteBaseUrl: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Token xác thực</label>
                <Input
                  type="password"
                  value={draft.websiteToken ?? ""}
                  placeholder={draft.websiteTokenConfigured ? "Token đã được lưu và đang được ẩn" : ""}
                  disabled={!canEditHunonicSecrets}
                  onChange={(event) => {
                    if (!canEditHunonicSecrets) return;
                    setSecretTouched((prev) => ({ ...prev, websiteToken: true }));
                    setDraft((prev) => ({ ...prev, websiteToken: event.target.value }));
                  }}
                />
              </div>
              <div className="xl:col-span-2 flex flex-col gap-[6px]">
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Cookie xác thực</label>
                <Input
                  type="password"
                  value={draft.websiteCookie ?? ""}
                  placeholder={draft.websiteCookieConfigured ? "Cookie đã được lưu và đang được ẩn" : ""}
                  disabled={!canEditHunonicSecrets}
                  onChange={(event) => {
                    if (!canEditHunonicSecrets) return;
                    setSecretTouched((prev) => ({ ...prev, websiteCookie: true }));
                    setDraft((prev) => ({ ...prev, websiteCookie: event.target.value }));
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-3">
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">URL ứng dụng mobile</label>
                <Input value={draft.baseUrl ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))} />
                <p className="text-[11px] font-semibold text-muted">Có thể nhập domain gốc, backend sẽ tự dùng /v2 cho api.hunonicpro.com.</p>
              </div>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Tài khoản</label>
                <Input value={draft.username ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, username: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Mật khẩu</label>
                <Input
                  type="password"
                  value={draft.password ?? ""}
                  placeholder={draft.passwordConfigured ? "Mật khẩu đã được lưu và đang được ẩn" : ""}
                  disabled={!canEditHunonicSecrets}
                  onChange={(event) => {
                    if (!canEditHunonicSecrets) return;
                    setSecretTouched((prev) => ({ ...prev, password: true }));
                    setDraft((prev) => ({ ...prev, password: event.target.value }));
                  }}
                />
              </div>
            </div>
          )}

          {!canEditHunonicSecrets && (
            <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-[12px] py-[10px] text-[12px] font-semibold text-amber-800">
              Chỉ admin@homeland.vn được chỉnh sửa token hoặc mật khẩu tích hợp Hunonic. Tài khoản vận hành chỉ được xem trạng thái, kiểm tra kết nối và sync.
            </div>
          )}

          {canEditHunonicSecrets && (
            <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-[12px] py-[10px] text-[12px] font-semibold text-emerald-800">
              {draft.mode === "mobile"
                ? draft.passwordConfigured && !secretTouched.password
                  ? "Mật khẩu Hunonic mobile đã được lưu. Nhập giá trị mới chỉ khi cần thay đổi."
                  : "Nhập mật khẩu Hunonic mobile rồi bấm Lưu cấu hình hoặc Kiểm tra kết nối."
                : (draft.websiteTokenConfigured || draft.websiteCookieConfigured) && !secretTouched.websiteToken && !secretTouched.websiteCookie
                  ? "Token/Cookie Hunonic website đã được lưu. Nhập giá trị mới chỉ khi cần thay đổi."
                  : "Nhập token hoặc cookie Hunonic website rồi bấm Lưu cấu hình hoặc Kiểm tra kết nối."}
            </div>
          )}

          <div className="flex flex-col justify-between gap-[12px] sm:flex-row sm:items-center">
            <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
              <Clock size={14} />
              Lần đồng bộ gần nhất: {formatDate(latestLog?.finishedAt || latestLog?.startedAt)}
            </div>
            <div className="flex flex-col gap-[10px] sm:flex-row">
              <Button type="button" variant="outline" onClick={testConnection} isLoading={isTesting} className="h-[42px]">
                Kiểm tra kết nối
              </Button>
              <Button type="button" variant="outline" onClick={runSync} isLoading={isSyncing} className="h-[42px]">
                <RefreshCcw size={14} className="mr-2" />
                Đồng bộ ngay
              </Button>
              <Button type="button" onClick={saveHunonic} isLoading={isSaving} className="h-[42px] bg-primary text-white">
                Lưu cấu hình
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-border/70 bg-card/95 p-[18px]">
        <div className="flex flex-col gap-[16px]">
          <div>
            <h3 className="text-[15px] font-black text-text">Kiểm tra dữ liệu đồng bộ 3 năm</h3>
            <p className="mt-[3px] max-w-[760px] text-[12px] text-muted">
              Bảng lịch sử được đặt trong popup để trang cài đặt gọn hơn. Có thể lọc theo phòng, tòa, tháng/năm và khóa kỳ điện đã chốt để đồng bộ không ghi đè.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-[10px] min-[1120px]:grid-cols-5">
            <div className="rounded-[14px] border border-border/70 bg-background/80 p-[12px]">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">Bản ghi</div>
              <div className="mt-1 text-[18px] font-black text-text">{historySummary.totalReadings || 0}</div>
            </div>
            <div className="rounded-[14px] border border-border/70 bg-background/80 p-[12px]">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">Phòng có dữ liệu</div>
              <div className="mt-1 text-[18px] font-black text-text">{roomsWithData}</div>
            </div>
            <div className="rounded-[14px] border border-border/70 bg-background/80 p-[12px]">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">kWh</div>
              <div className="mt-1 text-[18px] font-black text-text">{formatKwh(historySummary.totalEnergyMonthKwh)}</div>
            </div>
            <div className="rounded-[14px] border border-border/70 bg-background/80 p-[12px]">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tiền</div>
              <div className="mt-1 text-[18px] font-black text-[#16a34a]">{formatMoney(historySummary.totalMoneyMonthVnd)}</div>
            </div>
            <div className="rounded-[14px] border border-border/70 bg-background/80 p-[12px]">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">Kỳ đã khóa</div>
              <div className="mt-1 text-[18px] font-black text-text">{lockedPeriods.length}</div>
            </div>
          </div>
          <div className="flex justify-end border-t border-border/70 pt-[14px]">
            <Button type="button" onClick={() => setIsHistoryOpen(true)} className="h-[42px] min-w-[180px] bg-primary text-white">
              Mở lịch sử
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-border/70 bg-card/95 p-[18px]">
        <div className="flex flex-col gap-[16px]">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#16a34a]">Cấu hình giá điện</div>
            <h3 className="mt-[4px] text-[16px] font-black text-text">Thiết lập giá theo công tơ</h3>
            <p className="mt-[4px] max-w-[780px] text-[12px] text-muted">
              Chọn một hoặc nhiều công tơ để áp dụng giá sinh hoạt EVN hoặc giá tùy chỉnh. Bảng chi tiết được đặt trong popup để trang gọn hơn.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-[10px]">
            <div className="rounded-[14px] border border-border/70 bg-background/80 p-[12px] text-center">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">Công tơ</div>
              <div className="mt-1 text-[18px] font-black text-text">{rateSummary.totalMeters || 0}</div>
            </div>
            <div className="rounded-[14px] border border-border/70 bg-background/80 p-[12px] text-center">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">EVN</div>
              <div className="mt-1 text-[18px] font-black text-text">{rateSummary.residentialMeters || 0}</div>
            </div>
            <div className="rounded-[14px] border border-border/70 bg-background/80 p-[12px] text-center">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tùy chỉnh</div>
              <div className="mt-1 text-[18px] font-black text-text">{rateSummary.customMeters || 0}</div>
            </div>
          </div>
          <div className="flex justify-end border-t border-border/70 pt-[14px]">
            <Button type="button" onClick={() => setIsRateOpen(true)} className="h-[42px] min-w-[180px] bg-primary text-white">
              Mở thiết lập giá
            </Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={isRateOpen} onClose={() => setIsRateOpen(false)} title="Giá điện Hunonic" maxWidth="max-w-[min(1180px,92vw)]">
        <div className="-m-5 mx-auto flex max-h-[calc(86vh-40px)] max-w-full flex-col overflow-hidden rounded-[16px] border border-border bg-card">
          <div className="flex flex-col gap-[14px] border-b border-border p-[16px] xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#16a34a]">Giá điện Hunonic</div>
              <h3 className="mt-[4px] text-[16px] font-black text-text">Chọn công tơ và mức giá cần áp dụng</h3>
              <p className="mt-[4px] max-w-[820px] text-[12px] text-muted">
                Dữ liệu giá được đọc trực tiếp từ Hunonic. Hệ thống sẽ yêu cầu xác nhận trước khi cập nhật.
              </p>
            </div>
            <div className="grid min-w-0 grid-cols-3 gap-[8px] xl:min-w-[360px]">
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

          <div className="grid grid-cols-1 gap-[10px] border-b border-border bg-background/70 p-[14px] xl:grid-cols-[1fr_220px_180px_180px]">
            <div className="grid grid-cols-2 gap-[8px]">
              <button
                type="button"
                onClick={() => setRateMode("residential")}
                className={`h-[42px] rounded-[12px] border text-[13px] font-black ${rateMode === "residential" ? "border-primary bg-primary text-white" : "border-border bg-card text-text"
                  }`}
              >
                Sinh hoạt EVN
              </button>
              <button
                type="button"
                onClick={() => setRateMode("custom")}
                className={`h-[42px] rounded-[12px] border text-[13px] font-black ${rateMode === "custom" ? "border-primary bg-primary text-white" : "border-border bg-card text-text"
                  }`}
              >
                Giá tùy chỉnh
              </button>
            </div>
            <Input
              type="number"
              min="1"
              value={customRate}
              onChange={(event) => setCustomRate(event.target.value)}
              disabled={rateMode !== "custom"}
              placeholder="Giá / kWh"
              className="h-[42px]"
            />
            <Button type="button" variant="outline" onClick={toggleAllRateRows} className="h-[42px]">
              {allRateSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </Button>
            <Button type="button" onClick={requestApplyRatePlan} isLoading={isApplyingRate} className="h-[42px] bg-primary text-white">
              Áp dụng {selectedRateIds.length ? `(${selectedRateIds.length})` : ""}
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[980px] table-fixed text-[13px]">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="w-[56px] px-[10px] py-[11px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Chọn</th>
                  <th className="w-[170px] px-[10px] py-[11px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Phòng</th>
                  <th className="w-[150px] px-[10px] py-[11px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Công tơ</th>
                  <th className="w-[140px] px-[10px] py-[11px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Chế độ hiện tại</th>
                  <th className="w-[130px] px-[10px] py-[11px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Giá tùy chỉnh</th>
                  <th className="w-[260px] px-[10px] py-[11px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Bậc EVN</th>
                  <th className="w-[150px] px-[10px] py-[11px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {rates.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-[14px] py-[30px] text-center font-medium text-muted">
                      Đang đọc bảng giá từ Hunonic...
                    </td>
                  </tr>
                ) : rateRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-[14px] py-[30px] text-center font-medium text-muted">
                      Chưa có công tơ để đọc bảng giá.
                    </td>
                  </tr>
                ) : (
                  rateRows.map((row) => {
                    const isSelected = selectedRateIds.includes(row.id);
                    const previewMode = isSelected ? rateMode : row.currentMode;
                    const previewCustomRate =
                      isSelected && rateMode === "custom" ? Number(customRate) : row.customRateVnd;

                    return (
                      <tr
                        key={row.id}
                        onClick={() => toggleRateRow(row.id)}
                        className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-background/70 ${isSelected ? "bg-primary/5" : ""
                          }`}
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
                        <td className="h-[54px] px-[10px] py-[10px] text-center align-middle font-black text-text whitespace-nowrap">
                          {row.buildingCode} / {row.displayName}
                        </td>
                        <td className="h-[54px] px-[10px] py-[10px] text-center align-middle text-muted truncate">
                          {row.deviceName}
                        </td>
                        <td className="h-[54px] px-[10px] py-[10px] text-center align-middle">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-black ${previewMode === "custom"
                              ? "bg-amber-500/10 text-amber-700"
                              : previewMode === "residential"
                                ? "bg-emerald-500/10 text-emerald-700"
                                : "bg-rose-500/10 text-rose-600"
                              }`}
                          >
                            {previewMode === "custom" ? "Tự thiết lập" : previewMode === "residential" ? "Sinh hoạt EVN" : "Lỗi đọc"}
                          </span>
                        </td>
                        <td className="h-[54px] px-[10px] py-[10px] text-center align-middle font-black text-text whitespace-nowrap">
                          {previewMode === "custom" && previewCustomRate ? formatMoney(previewCustomRate) : "--"}
                        </td>
                        <td className="h-[54px] px-[10px] py-[10px] text-center align-middle text-muted">
                          {row.residentialSteps?.length ? (
                            <span className="line-clamp-1">
                              {row.residentialSteps
                                .slice(0, 3)
                                .map((step: any) => `${step.minRate}-${step.maxRate}kWh: ${Number(step.price || 0).toLocaleString("vi-VN")}đ`)
                                .join(" | ")}
                            </span>
                          ) : row.error ? (
                            <span className="text-rose-600">{row.error}</span>
                          ) : (
                            "--"
                          )}
                        </td>
                        <td className="h-[54px] px-[10px] py-[10px] text-center align-middle text-muted whitespace-nowrap">
                          {formatDate(row.lastSyncedAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {residentialTemplate.length > 0 && (
            <div className="border-t border-border bg-background/60 p-[14px] text-[12px] text-muted">
              Mẫu EVN:{" "}
              {residentialTemplate
                .map((step: any) => `${step.minRate}-${step.maxRate} kWh ${Number(step.price || 0).toLocaleString("vi-VN")} đ`)
                .join(" | ")}
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

      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="Kiểm tra dữ liệu đồng bộ 3 năm" maxWidth="max-w-[min(1520px,96vw)]">
        <div className="-m-5 overflow-hidden rounded-[16px] border border-border bg-card">
          <div className="flex flex-col gap-[14px] border-b border-border p-[16px]">
            <div className="flex flex-col gap-[12px] xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-[15px] font-black text-text">Kiểm tra dữ liệu đồng bộ 3 năm</h3>
                <p className="mt-[3px] text-[12px] text-muted">
                  Lọc chỉ số kWh và tiền điện theo phòng, tháng, năm. Tổng hợp tháng dùng bản ghi mới nhất của từng phòng để tránh cộng lặp các lần đồng bộ theo giờ.
                </p>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-[10px] md:grid-cols-4 xl:min-w-[760px]">
                <div className="rounded-[12px] border border-border bg-background p-[12px]">
                  <div className="text-[10px] font-black uppercase text-muted">Dòng phòng-tháng</div>
                  <div className="mt-1 text-[18px] font-black text-text">{historySummary.totalReadings || 0}</div>
                  <div className="mt-[2px] text-[10px] font-semibold text-muted">1 phòng / 1 tháng</div>
                </div>
                <div className="rounded-[12px] border border-border bg-background p-[12px]">
                  <div className="text-[10px] font-black uppercase text-muted">Phòng có dữ liệu</div>
                  <div className="mt-1 text-[18px] font-black text-text">{roomsWithData}</div>
                  <div className="mt-[2px] text-[10px] font-semibold text-muted">Phòng thật</div>
                </div>
                <div className="rounded-[12px] border border-border bg-background p-[12px]">
                  <div className="text-[10px] font-black uppercase text-muted">Kỳ đã khóa</div>
                  <div className="mt-1 text-[18px] font-black text-text">{lockedPeriods.length}</div>
                </div>
                <div className="rounded-[12px] border border-border bg-background p-[12px]">
                  <div className="text-[10px] font-black uppercase text-muted">Tổng kWh</div>
                  <div className="mt-1 text-[18px] font-black text-text">{formatKwh(historySummary.totalEnergyMonthKwh)}</div>
                </div>
                <div className="rounded-[12px] border border-border bg-background p-[12px]">
                  <div className="text-[10px] font-black uppercase text-muted">Tổng tiền điện</div>
                  <div className="mt-1 text-[18px] font-black text-[#16a34a]">{formatMoney(historySummary.totalMoneyMonthVnd)}</div>
                </div>
                <div className="rounded-[12px] border border-border bg-background p-[12px]">
                  <div className="text-[10px] font-black uppercase text-muted">Trùng dữ liệu</div>
                  <div className="mt-1 text-[18px] font-black text-amber-700">{dataQuality.duplicatePeriods || 0}</div>
                </div>
                <div className="rounded-[12px] border border-border bg-background p-[12px]">
                  <div className="text-[10px] font-black uppercase text-muted">Thiếu kỳ</div>
                  <div className="mt-1 text-[18px] font-black text-rose-700">{dataQuality.missingPeriods || 0}</div>
                </div>
                <div className="rounded-[12px] border border-border bg-background p-[12px]">
                  <div className="text-[10px] font-black uppercase text-muted">Bất thường</div>
                  <div className="mt-1 text-[18px] font-black text-amber-700">{dataQuality.abnormalPeriods || 0}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-[10px] md:grid-cols-[minmax(220px,1.3fr)_repeat(4,minmax(120px,0.7fr))]">
              <div className="relative">
                <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
                <Input value={historyFilters.search} onChange={(event) => patchHistoryFilter({ search: event.target.value })} placeholder="Tìm phòng, công tơ..." className="pl-[34px]" />
              </div>
              <select value={historyFilters.buildingCode} onChange={(event) => patchHistoryFilter({ buildingCode: event.target.value, roomCode: "all" })} className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none">
                <option value="all">Tất cả tòa</option>
                {buildingOptions.map((buildingCode) => (
                  <option key={buildingCode} value={buildingCode}>
                    {buildingCode}
                  </option>
                ))}
              </select>
              <select value={historyFilters.roomCode} onChange={(event) => patchHistoryFilter({ roomCode: event.target.value })} className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none">
                <option value="all">Tất cả phòng</option>
                {historyRooms
                  .filter((room) => historyFilters.buildingCode === "all" || room.buildingCode === historyFilters.buildingCode)
                  .map((room) => (
                    <option key={roomIdentity(room.buildingCode, room.roomCode)} value={room.roomCode}>
                      {room.buildingCode} / {room.displayName}
                    </option>
                  ))}
              </select>
              <select value={historyFilters.year} onChange={(event) => patchHistoryFilter({ year: event.target.value })} className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none">
                <option value="all">3 năm gần nhất</option>
                {(historyData.filters?.availableYears || [new Date().getFullYear()]).map((year: number) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
              <select value={historyFilters.month} onChange={(event) => patchHistoryFilter({ month: event.target.value })} className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none">
                <option value="all">Cả năm</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={String(month)}>
                    Tháng {month}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-b border-border p-[16px]">
            <div className="mb-[10px] flex flex-col gap-[10px] xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-[8px] text-[12px] font-black uppercase tracking-wide text-muted">
                  <CalendarDays size={14} />
                  Điện theo phòng và tháng
                </div>
                <p className="mt-[4px] text-[12px] font-medium text-muted">
                  Mỗi dòng là dữ liệu mới nhất của một phòng trong một tháng, không phải số lượng phòng.
                </p>
              </div>
              <div className="flex flex-wrap gap-[8px]">
                <Button type="button" variant="outline" onClick={exportHistoryCsv} className="h-[38px]">
                  Xuất CSV
                </Button>
                <Button type="button" variant="outline" onClick={toggleAllMonthlyRows} className="h-[38px]">
                  {allMonthlySelected ? "Bỏ chọn kỳ điện" : "Chọn tất cả kỳ điện"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyHistoryLock("unlock", selectedMonthlyRows)}
                  isLoading={isLockingHistory}
                  disabled={selectedMonthlyRows.length === 0}
                  className="h-[38px]"
                >
                  Mở khóa
                </Button>
                <Button
                  type="button"
                  onClick={() => applyHistoryLock("lock", selectedMonthlyRows)}
                  isLoading={isLockingHistory}
                  disabled={selectedMonthlyRows.length === 0}
                  className="h-[38px] bg-primary text-white"
                >
                  Khóa kỳ đã chọn {selectedMonthlyRows.length ? `(${selectedMonthlyRows.length})` : ""}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[14px] border border-border">
              <table className="w-full min-w-[1120px] table-fixed text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="w-[64px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Chọn</th>
                    <th className="w-[110px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Tháng</th>
                    <th className="w-[190px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Phòng</th>
                    <th className="w-[160px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Tên công tơ</th>
                    <th className="w-[130px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Đang dùng</th>
                    <th className="w-[140px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Điện tháng</th>
                    <th className="w-[150px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Tiền tháng</th>
                    <th className="w-[120px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Trạng thái</th>
                    <th className="w-[170px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Lần đọc</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-[14px] py-[28px] text-center font-medium text-muted">
                        Chưa có dữ liệu phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    monthlyRows.map((row: any) => {
                      const selected = selectedMonthlyKeys.includes(rowKey(row));
                      return (
                        <tr
                          key={rowKey(row)}
                          onClick={() => toggleMonthlyRow(row)}
                          className={`cursor-pointer border-b border-border/60 hover:bg-background/60 ${selected ? "bg-primary/5" : ""}`}
                        >
                          <td className="h-[48px] text-center align-middle">
                            <input
                              type="checkbox"
                              checked={selected}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleMonthlyRow(row)}
                              className="h-[16px] w-[16px] accent-primary"
                            />
                          </td>
                          <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-black text-text">{row.period}</td>
                          <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-black text-text whitespace-nowrap">
                            {row.buildingCode} / {row.displayName}
                          </td>
                          <td className="h-[48px] px-[12px] py-[10px] text-center align-middle text-muted truncate">{row.deviceName}</td>
                          <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-bold text-text">{Number(row.powerCurrentW || 0).toLocaleString("vi-VN")} W</td>
                          <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-bold text-text">{formatKwh(row.energyMonthKwh)}</td>
                          <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-black text-[#16a34a]">{formatMoney(row.moneyMonthVnd)}</td>
                          <td className="h-[48px] px-[12px] py-[10px] text-center align-middle">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-black ${row.isLocked ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                              {row.isLocked ? "Đã khóa" : "Đang mở"}
                            </span>
                          </td>
                          <td className="h-[48px] px-[12px] py-[10px] text-center align-middle text-muted whitespace-nowrap">{formatDate(row.readingAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-b border-border p-[16px]">
            <div className="mb-[10px] flex flex-col gap-[10px] xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-[8px] text-[12px] font-black uppercase tracking-wide text-muted">
                  <CheckCircle2 size={14} />
                  Đối chiếu Hunonic với hóa đơn
                </div>
                <p className="mt-[4px] text-[12px] font-medium text-muted">
                  So tiền điện Hunonic đã đồng bộ với hóa đơn điện đã phát hành trong cùng phòng và cùng tháng.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-3">
                <div className="rounded-[12px] border border-border bg-background px-[12px] py-[10px] text-center">
                  <div className="text-[10px] font-black uppercase text-muted">Khớp</div>
                  <div className="text-[16px] font-black text-emerald-700">{reconciliationSummary.matchedRows || 0}</div>
                </div>
                <div className="rounded-[12px] border border-border bg-background px-[12px] py-[10px] text-center">
                  <div className="text-[10px] font-black uppercase text-muted">Lệch tiền</div>
                  <div className="text-[16px] font-black text-amber-700">{reconciliationSummary.mismatchedRows || 0}</div>
                </div>
                <div className="rounded-[12px] border border-border bg-background px-[12px] py-[10px] text-center">
                  <div className="text-[10px] font-black uppercase text-muted">Chưa có hóa đơn</div>
                  <div className="text-[16px] font-black text-rose-700">{reconciliationSummary.missingInvoiceRows || 0}</div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[14px] border border-border">
              <table className="w-full min-w-[1080px] table-fixed text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="w-[110px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Tháng</th>
                    <th className="w-[190px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Phòng</th>
                    <th className="w-[140px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Tiền Hunonic</th>
                    <th className="w-[140px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Tiền hóa đơn</th>
                    <th className="w-[140px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Chênh lệch</th>
                    <th className="w-[120px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Số hóa đơn</th>
                    <th className="w-[150px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Trạng thái</th>
                    <th className="w-[120px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Khóa kỳ</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliationRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-[14px] py-[28px] text-center font-medium text-muted">
                        Chưa có dữ liệu đối chiếu phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    reconciliationRows.map((row: any) => (
                      <tr key={`reconciliation-${rowKey(row)}`} className="border-b border-border/60 hover:bg-background/60">
                        <td className="h-[48px] px-[12px] text-center align-middle font-black text-text">{row.period}</td>
                        <td className="h-[48px] px-[12px] text-center align-middle font-black text-text whitespace-nowrap">{row.buildingCode} / {row.displayName}</td>
                        <td className="h-[48px] px-[12px] text-center align-middle font-black text-[#16a34a]">{formatMoney(row.moneyMonthVnd)}</td>
                        <td className="h-[48px] px-[12px] text-center align-middle font-black text-text">{row.invoiceAmountVnd === null ? "--" : formatMoney(row.invoiceAmountVnd)}</td>
                        <td className={`h-[48px] px-[12px] text-center align-middle font-black ${row.diffAmountVnd === null ? "text-muted" : Math.abs(Number(row.diffAmountVnd || 0)) <= 1 ? "text-emerald-700" : "text-amber-700"}`}>
                          {row.diffAmountVnd === null ? "--" : formatMoney(row.diffAmountVnd)}
                        </td>
                        <td className="h-[48px] px-[12px] text-center align-middle font-bold text-text">{row.invoiceCount || 0}</td>
                        <td className="h-[48px] px-[12px] text-center align-middle">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-black ${row.reconciliationStatus === "MATCHED"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : row.reconciliationStatus === "MISSING_INVOICE"
                                ? "bg-rose-500/10 text-rose-600"
                                : "bg-amber-500/10 text-amber-700"
                              }`}
                          >
                            {row.reconciliationStatus === "MATCHED"
                              ? "Khớp"
                              : row.reconciliationStatus === "MISSING_INVOICE"
                                ? "Thiếu hóa đơn"
                                : "Lệch số tiền"}
                          </span>
                        </td>
                        <td className="h-[48px] px-[12px] text-center align-middle">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-black ${row.isLocked ? "bg-amber-500/10 text-amber-700" : "bg-slate-500/10 text-slate-600"}`}>
                            {row.isLocked ? "Đã khóa" : "Chưa khóa"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-b border-border p-[16px]">
            <div className="mb-[10px] flex items-center gap-[8px] text-[12px] font-black uppercase tracking-wide text-muted">
              <Shield size={14} />
              Cảnh báo dữ liệu Hunonic
            </div>

            <div className="overflow-x-auto rounded-[14px] border border-border">
              <table className="w-full min-w-[980px] table-fixed text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="w-[140px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Loại cảnh báo</th>
                    <th className="w-[110px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Tháng</th>
                    <th className="w-[210px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Phòng</th>
                    <th className="px-[12px] py-[12px] text-left text-[10px] font-black uppercase tracking-wide text-muted">Mô tả</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-[14px] py-[28px] text-center font-medium text-muted">
                        Không phát hiện cảnh báo chất lượng dữ liệu theo bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    qualityAlerts.map((alert: any, index: number) => (
                      <tr key={`quality-${alert.type}-${rowKey(alert)}-${index}`} className="border-b border-border/60 hover:bg-background/60">
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-black ${alert.type === "MISSING"
                              ? "bg-rose-500/10 text-rose-600"
                              : alert.type === "DUPLICATE"
                                ? "bg-amber-500/10 text-amber-700"
                                : "bg-orange-500/10 text-orange-700"
                              }`}
                          >
                            {alert.type === "MISSING" ? "Thiếu kỳ" : alert.type === "DUPLICATE" ? "Trùng bản ghi" : "Bất thường"}
                          </span>
                        </td>
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-black text-text">{alert.period || "--"}</td>
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-black text-text whitespace-nowrap">
                          {alert.buildingCode} / {alert.displayName}
                        </td>
                        <td className="h-[48px] px-[12px] py-[10px] text-left align-middle font-medium text-muted">{alert.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-[16px]">
            <div className="mb-[10px] flex items-center justify-between gap-[12px]">
              <div className="flex items-center gap-[8px] text-[12px] font-black uppercase tracking-wide text-muted">
                <Database size={14} />
                Log dữ liệu đã sync
              </div>
              <div className="text-[12px] font-bold text-muted">
                Trang {pagination.page} / {pagination.totalPages}
              </div>
            </div>

            <div className="overflow-x-auto rounded-[14px] border border-border">
              <table className="w-full min-w-[980px] table-fixed text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="w-[170px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Thời điểm</th>
                    <th className="w-[190px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Phòng</th>
                    <th className="w-[150px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Công tơ</th>
                    <th className="w-[110px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Trạng thái</th>
                    <th className="w-[130px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Công suất</th>
                    <th className="w-[140px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">kWh tháng</th>
                    <th className="w-[150px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Tiền tháng</th>
                    <th className="w-[160px] px-[12px] py-[12px] text-center text-[10px] font-black uppercase tracking-wide text-muted">Tiền tháng trước</th>
                  </tr>
                </thead>
                <tbody>
                  {readingRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-[14px] py-[28px] text-center font-medium text-muted">
                        Chưa có nhật ký đồng bộ phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    readingRows.map((row: any) => (
                      <tr key={row.id} className="border-b border-border/60 hover:bg-background/60">
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle text-muted whitespace-nowrap">{formatDate(row.readingAt)}</td>
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-black text-text whitespace-nowrap">{row.buildingCode} / {row.displayName}</td>
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle text-muted truncate">{row.deviceName}</td>
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-black ${row.status === "on" ? "bg-emerald-500/10 text-emerald-700" : "bg-slate-500/10 text-slate-600"}`}>
                            {row.status || "unknown"}
                          </span>
                        </td>
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-bold text-text whitespace-nowrap">{Number(row.powerCurrentW || 0).toLocaleString("vi-VN")} W</td>
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-bold text-text whitespace-nowrap">{formatKwh(row.energyMonthKwh)}</td>
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-black text-[#16a34a] whitespace-nowrap">{formatMoney(row.moneyMonthVnd)}</td>
                        <td className="h-[48px] px-[12px] py-[10px] text-center align-middle font-bold text-muted whitespace-nowrap">{formatMoney(row.moneyPrevMonthVnd)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-[14px] flex flex-col justify-between gap-[10px] sm:flex-row sm:items-center">
              <div className="text-[12px] font-bold text-muted">
                {pagination.total} bản ghi, hiển thị {readingRows.length} bản ghi/trang
              </div>
              <div className="flex items-center gap-[8px]">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pagination.page <= 1 || history.isLoading}
                  onClick={() => patchHistoryFilter({ page: Math.max(1, pagination.page - 1) })}
                  className="h-[36px]"
                >
                  Trước
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages || history.isLoading}
                  onClick={() => patchHistoryFilter({ page: pagination.page + 1 })}
                  className="h-[36px]"
                >
                  Sau
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
