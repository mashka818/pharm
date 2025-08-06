import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class UserOwnershipGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const user = request.user;

    if (!user) throw new UnauthorizedException();

    const userIdFromToken = user.id;

    const requestedUserId = request.params.id;

    if (+userIdFromToken !== +requestedUserId) {
      throw new ForbiddenException('You do not have permission for this user');
    }

    return true;
  }
}
