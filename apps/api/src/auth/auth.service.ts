import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AuthResponse, LoginInput, RegisterInput } from '@url-shortener/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const hash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: { email, password: hash },
      select: { id: true, email: true },
    });
    return this.issue(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(input.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issue({ id: user.id, email: user.email });
  }

  private issue(user: { id: string; email: string }): AuthResponse {
    const token = this.jwt.sign({ sub: user.id, email: user.email });
    return { token, user };
  }
}
