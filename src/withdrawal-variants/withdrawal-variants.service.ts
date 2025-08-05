import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateWithdrawalVariantDto } from './dto/create-withdrawal-variant.dto';
import { UpdateWithdrawalVariantDto } from './dto/update-withdrawal-variant.dto';

@Injectable()
export class WithdrawalVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllByCustomerId(customerId: number) {
    return await this.prisma.withdrawalVariant.findMany({ where: { customerId } });
  }

  async getOne(id: number) {
    return await this.prisma.withdrawalVariant.findUnique({ where: { id } });
  }

  async create(
    createWithdrawalVariantDto: CreateWithdrawalVariantDto,
    customerId: number,
  ): Promise<UpdateWithdrawalVariantDto> {
    return await this.prisma.withdrawalVariant.create({
      data: { ...createWithdrawalVariantDto, customerId },
    });
  }

  async remove(id: number, customerId: number) {
    const variant = await this.getOne(id);
    if (!variant) {
      throw new NotFoundException('Withdrawal variant not found');
    }
    if (customerId !== variant.customerId) {
      throw new ForbiddenException('You have no permission to delete this withdrawal variant');
    }
    await this.prisma.withdrawalVariant.delete({ where: { id } });
    return 'Withdrawal variant has been deleted';
  }
}
