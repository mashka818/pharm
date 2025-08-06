import { OmitType } from '@nestjs/swagger';
import { CreateCompanyDto } from './create-company.dto';

export class LoginCompanyDto extends OmitType(CreateCompanyDto, ['promotionId']) {}
