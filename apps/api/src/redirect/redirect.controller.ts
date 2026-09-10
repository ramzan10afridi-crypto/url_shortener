import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClicksService } from '../clicks/clicks.service';
import { UrlsService } from '../urls/urls.service';

@Controller()
export class RedirectController {
  constructor(
    private readonly urls: UrlsService,
    private readonly clicks: ClicksService,
  ) {}

  @Get(':shortCode')
  async redirect(
    @Param('shortCode') shortCode: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { target, urlId } = await this.urls.resolveAndCount(shortCode);
    // Fire-and-forget: don't block the redirect on the click log or geo lookup.
    this.clicks.record(urlId, {
      ip: req.ip,
      referer: req.get('referer') ?? req.get('referrer') ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
    return res.redirect(302, target);
  }
}
