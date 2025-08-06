import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { TAllUsers } from '../types/all-users.type';

@Injectable()
export class CompanyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: TAllUsers = request.user;

    if (!user) throw new UnauthorizedException();

    if (user.role !== 'COMPANY' && user.role !== 'ADMIN') {
      throw new ForbiddenException('You are not Company or admin');
    }

    return true;
  }
}
