import { IsNumber, IsString } from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';
import { ApiProperty } from '@nestjs/swagger';
import { PromotionDto } from 'src/promotions/dto/promotion.dto';

export class UpdateCompanyDto extends CreateCompanyDto {
  @ApiProperty({
    description: 'Id of company user',
    example: '1',
    required: true,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Role of company',
    example: 'COMPANY',
    required: true,
  })
  @IsString()
  role: 'COMPANY';

  promotion?: PromotionDto;
}
