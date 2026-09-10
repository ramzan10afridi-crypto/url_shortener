import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lookupCountry } from './geo';

interface ClickMeta {
  ip?: string;
  referer?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ClicksService {
  private readonly logger = new Logger(ClicksService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Fire-and-forget: called from the redirect controller without await, so it
  // never blocks the 302 response. Any failure is swallowed and logged.
  record(urlId: string, meta: ClickMeta): void {
    void this.doRecord(urlId, meta).catch((err) => {
      this.logger.warn(`Failed to record click for url ${urlId}: ${err?.message ?? err}`);
    });
  }

  private async doRecord(urlId: string, meta: ClickMeta): Promise<void> {
    const click = await this.prisma.click.create({
      data: {
        urlId,
        referrer: meta.referer?.slice(0, 512) ?? null,
        userAgent: meta.userAgent?.slice(0, 512) ?? null,
      },
      select: { id: true },
    });

    if (meta.ip) {
      const country = await lookupCountry(meta.ip);
      if (country) {
        await this.prisma.click.update({
          where: { id: click.id },
          data: { country },
        });
      }
    }
  }

  async listForUrl(urlId: string, limit = 50) {
    return this.prisma.click.findMany({
      where: { urlId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        createdAt: true,
        country: true,
        referrer: true,
        userAgent: true,
      },
    });
  }

  // Analytics aggregation for a single URL. Uses Prisma groupBy for country/
  // referrer and a raw SQL query for the daily timeline (Postgres date_trunc).
  async analyticsFor(urlId: string) {
    const [byCountryRows, byReferrerRows, timelineRows] = await Promise.all([
      this.prisma.click.groupBy({
        by: ['country'],
        where: { urlId },
        _count: { _all: true },
      }),
      this.prisma.click.groupBy({
        by: ['referrer'],
        where: { urlId },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "Click"
        WHERE "urlId" = ${urlId}
          AND "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day ASC
      `,
    ]);

    const total = byCountryRows.reduce((sum, r) => sum + r._count._all, 0);

    const byCountry = byCountryRows
      .map((r) => ({ key: r.country ?? 'Unknown', count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    const byReferrer = byReferrerRows
      .map((r) => ({ key: normalizeReferrer(r.referrer), count: r._count._all }))
      .reduce<Map<string, number>>((acc, r) => {
        acc.set(r.key, (acc.get(r.key) ?? 0) + r.count);
        return acc;
      }, new Map());

    const byReferrerList = [...byReferrer.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    // Fill missing days with zeros for a smooth chart across the last 30 days.
    const timelineMap = new Map(
      timelineRows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]),
    );
    const timeline = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      timeline.push({ date: key, count: timelineMap.get(key) ?? 0 });
    }

    return { totalClicks: total, byCountry, byReferrer: byReferrerList, timeline };
  }
}

function normalizeReferrer(raw: string | null | undefined): string {
  if (!raw) return 'Direct';
  try {
    return new URL(raw).hostname || 'Direct';
  } catch {
    return raw.slice(0, 64);
  }
}
