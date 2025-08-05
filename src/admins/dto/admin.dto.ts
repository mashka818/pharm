import { LoginAdminDto } from './login-admin.dto';

export class AdminDto extends LoginAdminDto {
  id: number;
  role: 'ADMIN';
}
