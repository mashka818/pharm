import { IsNumber, IsString } from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';
import { ApiProperty } from '@nestjs/swagger';
import { PromotionDto } from 'src/promotions/dto/promotion.dto';

export class UpdateCompanyDto extends CreateCompanyDto {
  @ApiProperty({
    description: 'Идентификатор пользователя компании',
    example: 1,
    required: true,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Роль компании (всегда COMPANY)',
    example: 'COMPANY',
    required: true,
  })
  @IsString()
  role: 'COMPANY';

  promotion?: PromotionDto;
}
