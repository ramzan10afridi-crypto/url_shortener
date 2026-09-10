import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { LoginSchema, RegisterSchema } from '@url-shortener/shared';
import { AuthService } from './auth.service';
import { CurrentUser, RequestUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.auth.register(parsed.data);
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.auth.login(parsed.data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return user;
  }
}
