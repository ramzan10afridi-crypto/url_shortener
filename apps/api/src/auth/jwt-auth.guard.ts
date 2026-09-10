import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Standard guard — 401 if no/invalid token.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// Optional guard — attaches req.user if a valid token is present; otherwise passes through.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_err: any, user: any): TUser {
    return user || (null as any);
  }
  canActivate(ctx: ExecutionContext) {
    return super.canActivate(ctx);
  }
}
