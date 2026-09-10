import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CreateUrlSchema } from '@url-shortener/shared';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClicksService } from '../clicks/clicks.service';
import { UrlsService } from './urls.service';

@Controller('api/urls')
@UseGuards(OptionalJwtAuthGuard)
export class UrlsController {
  constructor(
    private readonly urls: UrlsService,
    private readonly clicks: ClicksService,
  ) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: RequestUser | null) {
    const parsed = CreateUrlSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.urls.create(parsed.data, user?.id ?? null);
  }

  @Get()
  list(
    @Query('limit') limit: string | undefined,
    @Query('mine') mine: string | undefined,
    @CurrentUser() user: RequestUser | null,
  ) {
    const n = limit ? Number(limit) : undefined;
    const mineOnly = mine === '1' || mine === 'true';
    return this.urls.list({
      limit: Number.isFinite(n as number) ? (n as number) : undefined,
      userId: user?.id ?? null,
      mineOnly,
    });
  }

  @Get(':id/clicks')
  async clicksFor(@Param('id') id: string, @CurrentUser() user: RequestUser | null) {
    await this.urls.findForOwner(id, user?.id ?? null);
    return this.clicks.listForUrl(id);
  }

  @Get(':id/analytics')
  async analyticsFor(@Param('id') id: string, @CurrentUser() user: RequestUser | null) {
    const url = await this.urls.findForOwner(id, user?.id ?? null);
    const agg = await this.clicks.analyticsFor(id);
    return {
      urlId: url.id,
      shortCode: url.shortCode,
      originalUrl: url.originalUrl,
      ...agg,
    };
  }
}
