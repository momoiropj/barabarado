// app/api/_lib/ratelimit.ts
type Hit = { t: number };
type Bucket = {
  hits: Hit[];          // 直近windowMsのヒット
  dayKey: string;       // 日付キー（UTC）
  dayCount: number;     // 今日のカウント
};

declare global {
  // eslint-disable-next-line no-var
  var __bbdoRateLimit: Map<string, Bucket> | undefined;
}

function store(): Map<string, Bucket> {
  if (!globalThis.__bbdoRateLimit) globalThis.__bbdoRateLimit = new Map();
  return globalThis.__bbdoRateLimit;
}

function getClientIp(req: Request): string {
  // Vercel/Proxy想定。最初のIPを使う
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();
  // ローカルなど
  return "unknown";
}

function utcDayKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function rateLimitOrThrow(
  req: Request,
  opts: {
    route: string;
    windowMs: number;      // 例: 60_000
    maxInWindow: number;   // 例: 10
    maxPerDay: number;     // 例: 200
  }
) {
  const ip = getClientIp(req);
  const key = `${opts.route}:${ip}`;

  const s = store();
  const now = Date.now();
  const day = utcDayKey();

  const b: Bucket = s.get(key) ?? { hits: [], dayKey: day, dayCount: 0 };

  // 日付更新
  if (b.dayKey !== day) {
    b.dayKey = day;
    b.dayCount = 0;
  }

  // window掃除
  const cutoff = now - opts.windowMs;
  b.hits = b.hits.filter((h) => h.t >= cutoff);

  // 日次上限
  if (b.dayCount >= opts.maxPerDay) {
    s.set(key, b);
    const retryAfter = 60 * 60; // 1h目安（厳密でなくOK）
    throw new Response(
      JSON.stringify({ error: "Rate limit exceeded (daily cap). Try later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  // 短期上限
  if (b.hits.length >= opts.maxInWindow) {
    // 次に通るまでの目安秒
    const oldest = b.hits[0]?.t ?? now;
    const waitMs = Math.max(0, opts.windowMs - (now - oldest));
    const retryAfter = Math.ceil(waitMs / 1000);

    s.set(key, b);
    throw new Response(
      JSON.stringify({ error: "Rate limit exceeded. Slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  // 記録
  b.hits.push({ t: now });
  b.dayCount += 1;
  s.set(key, b);
}
