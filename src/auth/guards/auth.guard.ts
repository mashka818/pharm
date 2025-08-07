import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  public constructor(
    private readonly authService: AuthService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isPublic) {
        return true;
      }
      const request = context.switchToHttp().getRequest();
      const { url } = request;
      if (url.startsWith('/api/auth')) {
        return true;
      }
      const { authorization } = request.headers;
      if (!authorization || authorization.trim() === '') {
        console.log('❌ Нет заголовка Authorization');
        throw new UnauthorizedException('Нет заголовка Authorization');
      }
      const authToken = authorization.replace(/bearer/gim, '').trim();
      let resp;
      try {
        resp = await this.authService.validateToken(authToken);
      } catch (err) {
        console.log('❌ Ошибка валидации токена:', err?.message || err);
        throw new UnauthorizedException('Ошибка валидации токена: ' + (err?.message || err));
      }
      if (!resp) {
        console.log('❌ Токен невалиден или пользователь не найден');
        throw new UnauthorizedException('Токен невалиден или пользователь не найден');
      }
      request.user = resp;
      return true;
    } catch (error) {
      console.log('❌ AuthGuard отказал в доступе:', error?.message || error);
      throw new UnauthorizedException(error?.message || error);
    }
  }
}
