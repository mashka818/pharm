import { IsNumber, IsString } from 'class-validator';
import { LoginAdminDto } from './login-admin.dto';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class UpdateAdminDto extends OmitType(LoginAdminDto, ['password']) {
  @ApiProperty({
    description: 'id of admin',
    example: '1',
    required: true,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'role of admin(ADMIN always)',
    example: 'ADMIN',
    required: true,
  })
  @IsString()
  role: 'ADMIN';
}
