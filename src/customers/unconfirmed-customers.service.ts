import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  CreateUnconfirmedCustomerDto,
  UpdateUnconfirmedCustomerDto,
} from './dto/unconfirmed-customer.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomersService } from './customers.service';

@Injectable()
export class UnconfirmedCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async clearUnconfirmed() {
    const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
    const customers = await this.prisma.unconfirmedCustomer.deleteMany({
      where: {
        createdAt: {
          lt: halfHourAgo,
        },
      },
    });
    console.log('clean unconfirmed table');
    return customers;
  }

  async getUnconfirmedByEmailAndPromotionId(
    email: string,
    promotionId: string,
  ): Promise<UpdateUnconfirmedCustomerDto> {
    const customers = await this.prisma.unconfirmedCustomer.findMany({
      where: {
        email,
        promotionId,
      },
    });

    return customers.length > 0 ? customers[0] : null;
  }

  async createUnconfirmed(
    unconfirmedCustomerDto: CreateUnconfirmedCustomerDto,
  ): Promise<UpdateUnconfirmedCustomerDto> {
    const { email, promotionId } = unconfirmedCustomerDto;

    const sameUnconfirmed = await this.getUnconfirmedByEmailAndPromotionId(email, promotionId);

    if (sameUnconfirmed) {
      throw new BadRequestException('Registration request already exist');
    }

    const sameCustomer = await this.customersService.getCustomerByEmailAndPromotionId(
      email,
      promotionId,
    );
    if (sameCustomer) {
      throw new BadRequestException('Customer already exist');
    }

    return await this.prisma.unconfirmedCustomer.create({
      data: { ...unconfirmedCustomerDto, role: 'CUSTOMER' },
    });
  }

  async getUnconfirmedByConfirmationToken(
    confirmationToken: string,
  ): Promise<UpdateUnconfirmedCustomerDto> {
    return this.prisma.unconfirmedCustomer.findUnique({ where: { confirmationToken } });
  }

  async remove(id: number) {
    return await this.prisma.unconfirmedCustomer.delete({ where: { id } });
  }
}
