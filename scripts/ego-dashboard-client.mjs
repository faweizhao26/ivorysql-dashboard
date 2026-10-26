import { createBrowserSyncToken } from '../src/lib/browser-sync-auth.mjs';

class DashboardSyncError extends Error {
  constructor(message, { fatal = false, recorded = false } = {}) {
    super(message);
    this.fatal = fatal;
    this.recorded = recorded;
  }
}

/** @param {{ baseUrl: string, adminPassword?: string, cronSecret?: string, fetchImpl?: typeof fetch }} options */
export function createDashboardClient({ baseUrl, adminPassword, cronSecret, fetchImpl = fetch }) {
  const endpoint = `${baseUrl}/api/browser-content/sync`;
  async function request(query = '', body = undefined) {
    const token = adminPassword ? await createBrowserSyncToken(adminPassword) : cronSecret || await createBrowserSyncToken(adminPassword);
    let response;
    try {
      response = await fetchImpl(endpoint + query, {
        method: body ? 'POST' : 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new DashboardSyncError('无法连接看板同步接口，已停止本轮采集', { fatal: true });
    }
    if ([401, 403, 301, 302, 303, 307, 308].includes(response.status)) {
      throw new DashboardSyncError('看板同步认证失败，请核对本地与 Vercel 的 ADMIN_PASSWORD / CRON_SECRET 是否一致', { fatal: true });
    }
    if ([404, 405].includes(response.status)) {
      throw new DashboardSyncError('新版同步接口尚未部署，请先部署本次修复', { fatal: true });
    }
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      throw new DashboardSyncError(`看板同步接口未返回 JSON（HTTP ${response.status}）`, { fatal: true });
    }
    if (!response.ok || !payload.success) {
      throw new DashboardSyncError(payload.error || `同步接口失败（HTTP ${response.status}）`, { recorded: Boolean(payload.runId) });
    }
    return payload;
  }
  return {
    async preflight() {
      const payload = await request();
      if (payload.version !== 1) throw new DashboardSyncError('新版同步接口尚未部署，请先部署本次修复', { fatal: true });
    },
    async existingDates(platform) {
      const payload = await request(`?platform=${encodeURIComponent(platform)}`);
      return new Map(payload.dates);
    },
    upload(platform, articles) { return request('', { platform, articles }); },
    reportFailure(platform, error) {
      return request('', { platform, status: 'failed', error: (error instanceof Error ? error.message : String(error)).slice(0, 1000) });
    },
  };
}

export async function runCollectors(collectors, upload, reportFailure, onResult = () => {}) {
  const results = [];
  for (const [platform, collect] of collectors) {
    let result;
    let stop = false;
    try {
      result = { platform, success: true, ...await upload(platform, await collect()) };
    } catch (error) {
      result = { platform, success: false, error: error instanceof Error ? error.message : String(error) };
      const controlStop = /user.*(?:taking control|taking over)|用户.*(?:接管|要求停止)|space is (?:inactive|unassigned)/i.test(result.error);
      if (controlStop) result.stopped_for_user = true;
      stop = Boolean(error?.fatal) || controlStop;
      if (!stop && !error?.recorded) {
        try {
          result.failureRecorded = await reportFailure(platform, error) !== false;
        } catch (reportError) {
          result.reportError = reportError instanceof Error ? reportError.message : String(reportError);
          stop = Boolean(reportError?.fatal);
        }
      }
    }
    results.push(result);
    onResult(result);
    if (stop) break;
  }
  return results;
}
