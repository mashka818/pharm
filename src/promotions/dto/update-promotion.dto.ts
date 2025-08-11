import { PartialType } from '@nestjs/swagger';
import { PromotionDto } from './promotion.dto';

export class UpdatePromotionDto extends PartialType(PromotionDto) {}
