import { createHash } from 'crypto';

const DEFAULT_BASE_URL = 'https://api.hunonicpro.com/v2';
const DEFAULT_WEBSITE_BASE_URL = 'https://web.hunonic.com/api/api/hun-api';

export type HunonicApiMode = 'mobile' | 'website';

export interface HunonicProviderOptions {
  mode?: HunonicApiMode | string;
  username?: string;
  password?: string;
  accountKey?: string;
  baseUrl?: string;
  websiteBaseUrl?: string;
  websiteToken?: string;
  websiteCookie?: string;
  mobileAccessKey?: string;
  mobileSecretKey?: string;
  lang?: string;
  timeoutMs?: number;
}

export interface HunonicElectricMeter {
  provider_meter_id: string | null;
  provider_device_id: string | null;
  provider_root_id: string | null;
  provider_home_id: string | null;
  home_name: string | null;
  provider_room_id: string | null;
  room_name: string | null;
  name: string | null;
  root_type: string | null;
  status: string;
  power_current_w: number | null;
  energy_month_kwh: number | null;
  money_month_vnd: number | null;
  energy_prev_month_kwh: number | null;
  money_prev_month_vnd: number | null;
  current_month: string | null;
  updated_at: string | null;
  raw?: unknown;
}

export interface HunonicDashboardData {
  provider: 'hunonic';
  source: HunonicApiMode;
  schema_version: 1;
  exported_at: string;
  summary: {
    homes: number;
    rooms: number;
    devices: number;
    electric_meters: number;
  };
  electric_meters: HunonicElectricMeter[];
}

export interface HunonicMonthlyHistoryPoint {
  provider_meter_id: string | null;
  provider_root_id: string | null;
  provider_device_id: string | null;
  name: string | null;
  period: string;
  year: number;
  month: number;
  energy_month_kwh: number;
  money_month_vnd: number;
  raw?: unknown;
}

export interface HunonicElectricityRateGroup {
  id: string;
  name: string;
  rates: Array<{
    id: string;
    minRate: number | null;
    maxRate: number | null;
    name: string | null;
    price: number | null;
    groupName: string | null;
  }>;
  raw?: unknown;
}

export type HunonicElectricityRateMode = 'residential' | 'custom';

export class HunonicApiError extends Error {
  constructor(message: string, public readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'HunonicApiError';
  }
}

export class HunonicProvider {
  private readonly mode: HunonicApiMode;
  private readonly username?: string;
  private readonly password?: string;
  private readonly accountKey?: string;
  private readonly baseUrl: string;
  private readonly websiteBaseUrl: string;
  private readonly websiteToken?: string;
  private readonly websiteCookie?: string;
  private readonly mobileAccessKey?: string;
  private readonly mobileSecretKey?: string;
  private readonly lang: string;
  private readonly timeoutMs: number;

  constructor(options: HunonicProviderOptions = {}) {
    this.mode = normalizeApiMode(options.mode || process.env.HUNONIC_API_MODE || 'mobile');
    this.username = options.username || process.env.HUNONIC_USER;
    this.password = options.password || process.env.HUNONIC_PASSWORD;
    this.accountKey = options.accountKey || inferAccountKey(this.username);
    this.baseUrl = normalizeMobileBaseUrl(options.baseUrl || process.env.HUNONIC_BASE_URL || DEFAULT_BASE_URL);
    this.websiteBaseUrl = trimTrailingSlash(
      options.websiteBaseUrl || process.env.HUNONIC_WEBSITE_BASE_URL || DEFAULT_WEBSITE_BASE_URL,
    );
    this.websiteToken = options.websiteToken || process.env.HUNONIC_WEB_TOKEN || process.env.HUNONIC_TOKEN;
    this.websiteCookie = options.websiteCookie || process.env.HUNONIC_WEB_COOKIE || process.env.HUNONIC_COOKIE;
    this.mobileAccessKey = options.mobileAccessKey || process.env.HUNONIC_MOBILE_ACCESS_KEY;
    this.mobileSecretKey = options.mobileSecretKey || process.env.HUNONIC_MOBILE_SECRET_KEY;
    this.lang = options.lang || process.env.HUNONIC_LANG || 'vi';
    this.timeoutMs = Number(options.timeoutMs || process.env.HUNONIC_TIMEOUT_MS || 15000);
  }

  async fetchDashboardData(): Promise<HunonicDashboardData> {
    const session = await this.createSession();
    const devicesResponse = await this.listDeviceByHome(session.tokenId);
    return buildDashboardExport({
      source: session.source,
      devicesResponse,
    });
  }

  async fetchRecentMonthlyHistory(monthCount = 12): Promise<{ dashboard: HunonicDashboardData; history: HunonicMonthlyHistoryPoint[] }> {
    const dashboard = await this.fetchDashboardData();
    const session = await this.createSession();
    const months = getRecentMonths(monthCount);
    const years = Array.from(new Set(months.map((month) => month.year)));
    const history: HunonicMonthlyHistoryPoint[] = [];

    const tokenId = session.source === 'mobile' ? session.tokenId : null;

    for (const meter of dashboard.electric_meters) {
      const rootId = meter.provider_root_id || meter.provider_meter_id;
      if (!rootId) continue;

      for (const year of years) {
        let responseData: any;
        if (session.source === 'website') {
          const response = await this.postWebsiteJson('/atmwifi/getDataGraph', {
            type: '3',
            root_id: rootId,
            time_start: `${year}-01-01`,
            time_end: `${year}-12-31`,
            year: String(year),
          });
          assertSuccess(response.data, 'Hunonic getDataGraph failed');
          responseData = response.data;
        } else {
          const response = await this.postForm('/atmwifi/getDataGraph', this.sign({
            token_id: tokenId,
            root_id: rootId,
            type: 3,
            year,
            time_start: `${year}-01-01`,
            time_end: `${year}-12-31`,
          }));
          assertSuccess(response.data, 'Hunonic getDataGraph failed');
          responseData = response.data;
        }

        const graphData = arrayOf(responseData?.data?.graph_data);
        const pointsByPeriod = new Map<string, any>();
        for (const item of graphData) {
          const parsed = parseGraphLabel(item?.label, year);
          if (!parsed) continue;
          pointsByPeriod.set(parsed.period, item);
        }

        for (const month of months.filter((item) => item.year === year)) {
          const item = pointsByPeriod.get(month.period);
          if (!item) continue;
          const energyKwh = numberOrNull(item.value) || 0;
          const moneyVnd = numberOrNull(item.amount) || 0;
          if (energyKwh > 0 || moneyVnd > 0) {
            history.push({
              provider_meter_id: meter.provider_meter_id,
              provider_root_id: meter.provider_root_id,
              provider_device_id: meter.provider_device_id,
              name: meter.name,
              period: month.period,
              year: month.year,
              month: month.month,
              energy_month_kwh: energyKwh,
              money_month_vnd: moneyVnd,
              raw: item,
            });
          }
        }
      }
    }

    return { dashboard, history };
  }

  async fetchElectricityRateGroups(rootId: string): Promise<HunonicElectricityRateGroup[]> {
    const tokenId = await this.login();
    return this.fetchElectricityRateGroupsWithToken(tokenId, rootId);
  }

  private async fetchElectricityRateGroupsWithToken(tokenId: string, rootId: string): Promise<HunonicElectricityRateGroup[]> {
    const response = await this.postForm('/atmwifi/electricityRate', this.sign({ token_id: tokenId, root_id: rootId }));
    assertSuccess(response.data, 'Hunonic electricityRate failed');
    return arrayOf(response.data?.data).map((group) => ({
      id: String(group.id || ''),
      name: String(group.name || ''),
      rates: normalizeElectricityRates(group.electricity_rate),
      raw: group,
    }));
  }

  async applyElectricityRate(rootId: string, mode: HunonicElectricityRateMode, customRateVnd?: number) {
    const tokenId = await this.login();
    const groups = await this.fetchElectricityRateGroupsWithToken(tokenId, rootId);
    const targetGroup = findElectricityRateGroup(groups, mode);
    if (mode === 'residential' && !targetGroup) {
      throw new HunonicApiError('Hunonic residential electricity rate group was not found.');
    }
    const groupId = targetGroup?.id || (mode === 'custom' ? '1' : '2');
    const groupName = targetGroup?.name || (mode === 'custom' ? 'Tự thiết lập' : 'Sinh hoạt');
    const ratePayload = mode === 'custom'
      ? buildCustomElectricityRatePayload(targetGroup, customRateVnd)
      : buildExistingElectricityRatePayload(targetGroup);
    if (mode === 'residential' && ratePayload.length === 0) {
      throw new HunonicApiError('Hunonic residential electricity rates are empty.');
    }

    const body: Record<string, unknown> = {
      token_id: tokenId,
      root_id: rootId,
      electricity_group_id: groupId,
      electricity_group_name: groupName,
      electricity_rate: JSON.stringify(ratePayload),
    };

    if (mode === 'custom') {
      body.rate = customRateVnd;
      body.price = customRateVnd;
      body.money = customRateVnd;
    }
    body.root_extra = JSON.stringify({
      electricity_group_id: groupId,
      electricity_group_name: groupName,
      electricity_rate: ratePayload,
      ...(mode === 'custom' ? { rate: customRateVnd, price: customRateVnd, money: customRateVnd } : {}),
    });

    const response = await this.postForm('/atmwifi/addElectricityRate', this.sign(body));
    assertSuccess(response.data, 'Hunonic addElectricityRate failed');
    return response.data;
  }

  private async createSession(): Promise<{ source: HunonicApiMode; tokenId: string | null }> {
    if (this.mode === 'website') {
      if (!this.websiteToken && !this.websiteCookie) {
        throw new Error('Missing Hunonic website token/cookie.');
      }
      return { source: 'website', tokenId: null };
    }

    const tokenId = await this.login();
    return { source: 'mobile', tokenId };
  }

  private async login(): Promise<string> {
    if (!this.username || !this.password) {
      throw new Error('Missing Hunonic mobile credentials.');
    }

    const body = this.sign({
      [this.accountKey || inferAccountKey(this.username)]: this.username,
      password: md5(this.password),
      app_name: 'hunonic',
      app_role: 1,
      lang: this.lang,
      is_pro_app: 1,
    });

    const response = await this.postForm('/user/login', body);
    assertSuccess(response.data, 'Hunonic login failed');
    const tokenId = findFirstKey(response.data, ['token_id', 'token']);
    if (!tokenId) throw new HunonicApiError('Hunonic login succeeded but token_id was not found.');
    return String(tokenId);
  }

  private async listDeviceByHome(tokenId: string | null) {
    if (this.mode === 'website') {
      const response = await this.getWebsiteJson('/device/listDeviceByHome');
      assertSuccess(response.data, 'Hunonic website listDeviceByHome failed');
      return response.data;
    }

    if (!tokenId) throw new Error('Missing Hunonic tokenId.');
    const response = await this.getJson(`/device/listDeviceByHome?token_id=${encodeURIComponent(tokenId)}`);
    assertSuccess(response.data, 'Hunonic listDeviceByHome failed');
    return response.data;
  }

  private sign(body: Record<string, unknown>) {
    if (!this.mobileAccessKey || !this.mobileSecretKey) {
      throw new HunonicApiError('Missing Hunonic mobile signing keys.');
    }
    return {
      ...body,
      signature: hunonicEncodeSign(body, this.mobileAccessKey, this.mobileSecretKey),
    };
  }

  private async postForm(apiPath: string, body: Record<string, unknown>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(body)) formData.append(key, String(value));
    return this.request(`${this.baseUrl}${ensureLeadingSlash(apiPath)}`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: formData,
    });
  }

  private async getJson(apiPath: string) {
    return this.request(`${this.baseUrl}${ensureLeadingSlash(apiPath)}`, {
      method: 'GET',
      headers: defaultHeaders(),
    });
  }

  private async getWebsiteJson(apiPath: string) {
    return this.request(`${this.websiteBaseUrl}${ensureLeadingSlash(apiPath)}`, {
      method: 'GET',
      headers: websiteHeaders({ token: this.websiteToken, cookie: this.websiteCookie }),
    });
  }

  private async postWebsiteJson(apiPath: string, body: Record<string, unknown>) {
    return this.request(`${this.websiteBaseUrl}${ensureLeadingSlash(apiPath)}`, {
      method: 'POST',
      headers: {
        ...websiteHeaders({ token: this.websiteToken, cookie: this.websiteCookie }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  private async request(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      return { status: response.status, data: parseJson(text), text };
    } catch (error: any) {
      throw new HunonicApiError(`Hunonic request failed: ${error.message}`, { url });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildDashboardExport({
  source,
  devicesResponse,
}: {
  source: HunonicApiMode;
  devicesResponse: any;
}): HunonicDashboardData {
  const homes = Array.isArray(devicesResponse?.data) ? devicesResponse.data : [];
  const flattened = flattenHomes(homes);
  const electricMeters = flattened.devices
    .filter(({ device }) => isElectricMeter(device))
    .map(({ home, room, device }) => normalizeElectricMeter({ home, room, device }));

  return {
    provider: 'hunonic',
    source,
    schema_version: 1,
    exported_at: new Date().toISOString(),
    summary: {
      homes: flattened.homes.length,
      rooms: flattened.rooms.length,
      devices: flattened.devices.length,
      electric_meters: electricMeters.length,
    },
    electric_meters: electricMeters,
  };
}

function flattenHomes(homes: any[]) {
  const flatHomes: any[] = [];
  const rooms: any[] = [];
  const devices: Array<{ home: any; room: any; device: any }> = [];

  for (const home of homes) {
    flatHomes.push({ provider_home_id: stringOrNull(home.id || home.home_id), name: home.name || home.home_name || null });
    for (const room of arrayOf(home.rooms)) {
      rooms.push({ provider_room_id: stringOrNull(room.id || room.room_id), name: room.name || room.room_name || null });
      for (const device of arrayOf(room.devices)) devices.push({ home, room, device });
    }
  }

  return { homes: flatHomes, rooms, devices };
}

function normalizeElectricMeter({ home, room, device }: { home: any; room: any; device: any }): HunonicElectricMeter {
  const rootExtra = parseJson(device.root_extra) || {};
  const value = parseJson(device.value) || {};
  const dataExtra = device.data_extra && typeof device.data_extra === 'object' ? device.data_extra : {};

  return {
    provider_meter_id: stringOrNull(device.root_id || device.id),
    provider_device_id: stringOrNull(device.id),
    provider_root_id: stringOrNull(device.root_id),
    provider_home_id: stringOrNull(home.id || home.home_id),
    home_name: home.name || home.home_name || null,
    provider_room_id: stringOrNull(room.id || room.room_id),
    room_name: room.name || room.room_name || null,
    name: device.name || null,
    root_type: device.root_type || null,
    status: readOnOffStatus(device, value),
    power_current_w: numberOrNull(dataExtra.power_current ?? rootExtra.power_current),
    energy_month_kwh: numberOrNull(rootExtra.power_of_month),
    money_month_vnd: numberOrNull(rootExtra.money_of_month),
    energy_prev_month_kwh: numberOrNull(rootExtra.power_of_prev_month),
    money_prev_month_vnd: numberOrNull(rootExtra.money_of_prev_month),
    current_month: rootExtra.current_month || null,
    updated_at: device.timeupdate || device.updated_at || null,
    raw: device,
  };
}

function normalizeElectricityRates(value: any) {
  if (!value) return [];
  const array = Array.isArray(value) ? value : typeof value === 'object' ? [value] : [];
  return array.map((rate) => ({
    id: String(rate.id || ''),
    minRate: numberOrNull(rate.min_rate),
    maxRate: numberOrNull(rate.max_rate),
    name: rate.name || null,
    price: numberOrNull(rate.price),
    groupName: rate.group_name || null,
  }));
}

function findElectricityRateGroup(groups: HunonicElectricityRateGroup[], mode: HunonicElectricityRateMode) {
  if (mode === 'custom') {
    return groups.find((group) => group.id === '1')
      || groups.find((group) => normalizeText(group.name).includes('tu thiet lap'));
  }
  return groups.find((group) => group.id === '2')
    || groups.find((group) => normalizeText(group.name).includes('sinh hoat'));
}

function buildExistingElectricityRatePayload(group?: HunonicElectricityRateGroup) {
  return normalizeElectricityRatePayload((group?.raw as any)?.electricity_rate, group?.name);
}

function buildCustomElectricityRatePayload(group: HunonicElectricityRateGroup | undefined, customRateVnd?: number) {
  const price = Number(customRateVnd);
  if (!Number.isFinite(price) || price <= 0) {
    throw new HunonicApiError('Invalid custom electricity rate.');
  }

  const existing = normalizeElectricityRatePayload((group?.raw as any)?.electricity_rate, group?.name);
  const base = existing.length > 0
    ? existing
    : [{ id: '', min_rate: 0, max_rate: 0, name: group?.name || 'Tự thiết lập', group_name: group?.name || 'Tự thiết lập', price }];

  return base.map((rate) => ({
    ...rate,
    price,
  }));
}

function normalizeElectricityRatePayload(value: any, fallbackGroupName?: string) {
  return arrayOf(value).map((rate) => ({
    id: rate.id === null || rate.id === undefined ? '' : String(rate.id),
    min_rate: numberOrNull(rate.min_rate) ?? 0,
    max_rate: numberOrNull(rate.max_rate) ?? 0,
    name: rate.name || null,
    group_name: rate.group_name || fallbackGroupName || null,
    price: numberOrNull(rate.price) ?? 0,
  }));
}

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hunonicEncodeSign(payload: Record<string, unknown>, accessKey: string, secretKey: string) {
  let total = 0;
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'signature') continue;
    total += scoreEntry(key, value);
  }
  return md5(`sha256fakeaccessKey=${accessKey}${md5(String(total))}${secretKey}`);
}

function scoreEntry(key: string, value: unknown) {
  const strValue = value === null || value === undefined ? '' : String(value);
  if (strValue !== '' && strValue !== '0') {
    const encoded = Buffer.from(strValue, 'utf8').toString('base64');
    if (/^-?\d+$/.test(encoded)) return Number.parseInt(encoded, 10);
    if (encoded.length > 0) {
      return encoded.charCodeAt(0) + encoded.charCodeAt(Math.floor(encoded.length / 2)) + encoded.charCodeAt(encoded.length - 1);
    }
    return 0;
  }
  return key !== '' ? key.charCodeAt(0) + 58 : 155;
}

function md5(value: string) {
  return createHash('md5').update(String(value)).digest('hex');
}

function readOnOffStatus(device: any, parsedValue: any) {
  const value = parsedValue || parseJson(device.value) || {};
  if (value.turn === 1 || value.turn === '1' || device.state === '1' || device.state === 1) return 'on';
  if (value.turn === 0 || value.turn === '0' || device.state === '0' || device.state === 0) return 'off';
  return 'unknown';
}

function isElectricMeter(device: any) {
  return ['elmeter', 'ElectricMeter'].includes(device?.root_type);
}

function assertSuccess(data: any, message: string) {
  if (data?.status === true || data?.code === 'success' || data?.success === true) return;
  const providerMessage = findFirstKey(data, ['message', 'msg', 'error', 'error_message']);
  throw new HunonicApiError(providerMessage ? `${message}: ${providerMessage}` : message, { data });
}

function findFirstKey(root: any, keys: string[]) {
  const queue = [root];
  const seen = new Set();
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    for (const key of keys) if (item[key]) return item[key];
    for (const value of Object.values(item)) if (value && typeof value === 'object') queue.push(value);
  }
  return null;
}

function defaultHeaders() {
  return { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' };
}

function websiteHeaders({ token, cookie }: { token?: string; cookie?: string }) {
  return compactObject({
    Accept: 'application/json, text/plain, */*',
    Authorization: token ? `Bearer ${token}` : undefined,
    Cookie: cookie || undefined,
    Referer: 'https://web.hunonic.com/',
    Origin: 'https://web.hunonic.com',
    'User-Agent': 'Mozilla/5.0 HomeLand-Hunonic/1.0',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  });
}

function normalizeApiMode(value: unknown): HunonicApiMode {
  const mode = String(value || '').trim().toLowerCase();
  return ['web', 'website', 'webiste'].includes(mode) ? 'website' : 'mobile';
}

function inferAccountKey(username?: string) {
  return String(username || '').includes('@') ? 'email' : 'phone';
}

function parseJson(value: any) {
  if (!value || typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function arrayOf(value: any) {
  return Array.isArray(value) ? value : [];
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function compactObject(object: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) as HeadersInit;
}

function getRecentMonths(count: number) {
  const now = new Date();
  const months: Array<{ year: number; month: number; period: string }> = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    months.push({ year, month, period: `${year}-${String(month).padStart(2, '0')}` });
  }
  return months;
}

function parseGraphLabel(label: unknown, fallbackYear: number) {
  const value = String(label || '').trim();
  const match = value.match(/^(\d{4})[-/](\d{1,2})$/) || value.match(/^(\d{1,2})$/);
  if (!match) return null;
  const year = match.length === 3 ? Number(match[1]) : fallbackYear;
  const month = match.length === 3 ? Number(match[2]) : Number(match[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month, period: `${year}-${String(month).padStart(2, '0')}` };
}

function trimTrailingSlash(value: string) {
  return String(value).replace(/\/+$/, '');
}

function normalizeMobileBaseUrl(value: string) {
  const raw = String(value || DEFAULT_BASE_URL).trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const trimmed = trimTrailingSlash(withProtocol);

  try {
    const url = new URL(trimmed);
    const pathname = trimTrailingSlash(url.pathname);
    if (url.hostname.toLowerCase() === 'api.hunonicpro.com' && (!pathname || pathname === '')) {
      url.pathname = '/v2';
      return trimTrailingSlash(url.toString());
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function ensureLeadingSlash(value: string) {
  return String(value).startsWith('/') ? String(value) : `/${value}`;
}
