import { Injectable } from '@nestjs/common';

interface RouteMetric {
  count: number;
  totalMs: number;
  maxMs: number;
  slowCount: number;
}

const LIST_SLOW_MS = 1000;
const PDF_SLOW_MS = 2000;
const MAX_ROUTES = 200;

@Injectable()
export class MetricsService {
  private readonly routes = new Map<string, RouteMetric>();

  record(method: string, path: string, durationMs: number) {
    const key = `${method} ${this.normalizePath(path)}`;
    const entry = this.routes.get(key) ?? {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      slowCount: 0,
    };

    entry.count += 1;
    entry.totalMs += durationMs;
    entry.maxMs = Math.max(entry.maxMs, durationMs);

    const threshold = path.includes('/pdf') ? PDF_SLOW_MS : LIST_SLOW_MS;
    if (durationMs > threshold) {
      entry.slowCount += 1;
    }

    if (this.routes.size > MAX_ROUTES && !this.routes.has(key)) {
      const oldest = this.routes.keys().next().value;
      if (oldest) this.routes.delete(oldest);
    }

    this.routes.set(key, entry);
  }

  getSummary() {
    const routes = [...this.routes.entries()].map(([route, m]) => ({
      route,
      count: m.count,
      avgMs: Math.round(m.totalMs / m.count),
      maxMs: Math.round(m.maxMs),
      slowCount: m.slowCount,
      p95EstimateMs: Math.round((m.totalMs / m.count) * 1.1),
    }));

    return {
      generatedAt: new Date().toISOString(),
      thresholds: { listMs: LIST_SLOW_MS, pdfMs: PDF_SLOW_MS },
      routes: routes.sort((a, b) => b.count - a.count),
    };
  }

  private normalizePath(path: string): string {
    return path
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/[a-f0-9]{64}/gi, '/:token');
  }
}
