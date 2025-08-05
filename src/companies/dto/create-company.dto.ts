import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({
    description: 'Username of company user',
    example: 'ivan_x-farm',
    required: true,
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'Password of company user',
    example: 'ivan_x-farm_password',
    required: true,
  })
  @IsString()
  password: string;

  @ApiProperty({
    description: 'PromotionId of company`s promotion(Unavailable to change)',
    example: 'x-pharm(Unavailable to change)',
    required: true,
  })
  @IsString()
  promotionId: string;
}
