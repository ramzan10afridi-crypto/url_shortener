import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import type { Url } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUrlInput, UrlDto } from '@url-shortener/shared';

const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const generateCode = customAlphabet(ALPHABET, 7);

const RESERVED = new Set(['health', 'api', 'urls', 'admin', 'favicon.ico']);

@Injectable()
export class UrlsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(url: Url): UrlDto {
    const base = process.env.PUBLIC_BASE_URL ?? '';
    return {
      id: url.id,
      shortCode: url.shortCode,
      originalUrl: url.originalUrl,
      clicks: url.clicks,
      createdAt: url.createdAt.toISOString(),
      shortUrl: `${base}/r/${url.shortCode}`,
      userId: url.userId,
    };
  }

  async create(input: CreateUrlInput, userId?: string | null): Promise<UrlDto> {
    if (input.customCode && RESERVED.has(input.customCode.toLowerCase())) {
      throw new BadRequestException('That code is reserved');
    }

    if (input.customCode) {
      const existing = await this.prisma.url.findUnique({ where: { shortCode: input.customCode } });
      if (existing) throw new ConflictException('Short code already in use');
      const url = await this.prisma.url.create({
        data: { shortCode: input.customCode, originalUrl: input.originalUrl, userId: userId ?? null },
      });
      return this.toDto(url);
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const shortCode = generateCode();
      try {
        const url = await this.prisma.url.create({
          data: { shortCode, originalUrl: input.originalUrl, userId: userId ?? null },
        });
        return this.toDto(url);
      } catch (err: any) {
        if (err?.code === 'P2002') continue;
        throw err;
      }
    }
    throw new ConflictException('Could not allocate a unique short code, please retry');
  }

  async list(opts: { limit?: number; userId?: string | null; mineOnly?: boolean } = {}): Promise<UrlDto[]> {
    const { limit = 50, userId, mineOnly } = opts;
    const where = mineOnly && userId ? { userId } : {};
    const urls = await this.prisma.url.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return urls.map((u) => this.toDto(u));
  }

  async resolveAndCount(shortCode: string): Promise<{ target: string; urlId: string }> {
    const url = await this.prisma.url.findUnique({ where: { shortCode } });
    if (!url) throw new NotFoundException('Short URL not found');
    // Fire-and-forget increment; we don't want to block the redirect on it.
    this.prisma.url
      .update({ where: { id: url.id }, data: { clicks: { increment: 1 } } })
      .catch(() => undefined);
    return { target: url.originalUrl, urlId: url.id };
  }

  // Returns the URL only if the caller owns it (or if it's an anonymous URL
  // with no owner, which is publicly readable). Used by the clicks endpoint.
  async findForOwner(id: string, userId: string | null | undefined) {
    const url = await this.prisma.url.findUnique({ where: { id } });
    if (!url) throw new NotFoundException('URL not found');
    if (url.userId && url.userId !== userId) {
      throw new NotFoundException('URL not found');
    }
    return url;
  }
}
