import { LoginAdminDto } from './login-admin.dto';
import { ApiProperty } from '@nestjs/swagger';

export class AdminDto extends LoginAdminDto {
  @ApiProperty({
    description: 'Идентификатор администратора',
    example: 1,
    required: true,
  })
  id: number;

  @ApiProperty({
    description: 'Роль администратора (всегда ADMIN)',
    example: 'ADMIN',
    required: true,
  })
  role: 'ADMIN';
}
