const IS_PRODUCTION = process.env.NODE_ENV === "production";

const DEBUG_ENABLED = process.env.CONVEX_LOG_DEBUG === "1" && !IS_PRODUCTION;
const INFO_SAMPLED_ENABLED = process.env.CONVEX_LOG_INFO_SAMPLED === "1";
const DEFAULT_SAMPLE_RATE = (() => {
  const raw = Number(process.env.CONVEX_LOG_SAMPLE_RATE ?? "0.01");
  if (!Number.isFinite(raw)) return 0.01;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
})();

function shouldSample(rate?: number): boolean {
  if (!INFO_SAMPLED_ENABLED) return false;
  if (!IS_PRODUCTION) return true;
  const effectiveRate =
    typeof rate === "number" && Number.isFinite(rate)
      ? Math.min(1, Math.max(0, rate))
      : DEFAULT_SAMPLE_RATE;
  return Math.random() < effectiveRate;
}

export function logDebug(...args: unknown[]): void {
  if (!DEBUG_ENABLED) return;
  console.log(...args);
}

export function logInfoSampled(...args: unknown[]): void {
  if (!shouldSample()) return;
  console.log(...args);
}

export function logWarn(...args: unknown[]): void {
  console.warn(...args);
}

export function logError(...args: unknown[]): void {
  console.error(...args);
}
