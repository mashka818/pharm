import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateOfferConditionDto } from './dto/create-offer-condition.dto';
import { UpdateOfferConditionDto } from './dto/update-offer-condition.dto';

@Injectable()
export class OffersConditionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOfferConditionDto: CreateOfferConditionDto) {
    return this.prisma.offerCondition.create({ data: createOfferConditionDto });
  }

  async update(
    updateOfferConditionDto: UpdateOfferConditionDto,
  ): Promise<UpdateOfferConditionDto | undefined> {
    await this.getOne(updateOfferConditionDto.id);
    return this.prisma.offerCondition.update({
      where: { id: updateOfferConditionDto.id },
      data: updateOfferConditionDto,
    });
  }

  async getOne(id: number) {
    const condition = this.prisma.offerCondition.findUnique({ where: { id } });
    if (!condition) {
      throw new NotFoundException(`Offer condition not found`);
    }
    return condition;
  }

  async remove(id: number) {
    await this.getOne(id);
    return this.prisma.offerCondition.delete({ where: { id } });
  }
}
