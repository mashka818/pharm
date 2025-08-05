import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TAllUsers } from '../types/all-users.type';

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: TAllUsers = request.user;

    if (!user) throw new UnauthorizedException();

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('You are not Admin');
    }

    return true;
  }
}
