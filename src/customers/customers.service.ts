import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { WithdrawalVariantsService } from 'src/withdrawal-variants/withdrawal-variants.service';
import { CustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly withdrawalVariantsService: WithdrawalVariantsService,
  ) {}

  async getCustomerByEmailAndPromotionId(email: string, promotionId: string): Promise<CustomerDto> {
    const customers = await this.prisma.customer.findMany({
      where: {
        email,
        promotionId,
      },
    });

    return customers.length > 0 ? customers[0] : null;
  }

  async create(createCustomerDto: CreateCustomerDto) {
    await this.prisma.customer.create({ data: { ...createCustomerDto, role: 'CUSTOMER' } });
  }

  async getOne(id: number, withPassword?: boolean): Promise<CustomerDto> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    if (withPassword) {
      return customer;
    }
    const { password, ...restCustomer } = customer;

    return restCustomer;
  }

  async getAllByEmail(email: string): Promise<CustomerDto[]> {
    return await this.prisma.customer.findMany({ where: { email } });
  }

  async getAll(): Promise<CustomerDto[]> {
    const customers = await this.prisma.customer.findMany();
    return customers.map(({ password, ...rest }) => rest as unknown as CustomerDto);
  }

  async remove(id: number): Promise<{ message: string }>{
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1) Cashbacks → CashbackItems → Cashbacks
      const cashbackIds = (
        await tx.cashback.findMany({
          where: { customerId: id },
          select: { id: true },
        })
      ).map((c) => c.id);
      if (cashbackIds.length > 0) {
        await tx.cashbackItem.deleteMany({ where: { cashbackId: { in: cashbackIds } } });
        await tx.cashback.deleteMany({ where: { id: { in: cashbackIds } } });
      }

      // 2) Withdrawals → WithdrawalVariants
      const wvIds = (
        await tx.withdrawalVariant.findMany({
          where: { customerId: id },
          select: { id: true },
        })
      ).map((w) => w.id);
      if (wvIds.length > 0) {
        await tx.withdrawal.deleteMany({ where: { withdrawalVariantId: { in: wvIds } } });
        await tx.withdrawalVariant.deleteMany({ where: { id: { in: wvIds } } });
      }

      // 3) Admin notifications linked to customer
      await tx.adminNotification.deleteMany({ where: { customerId: id } });

      // 4) FNS requests linked to customer
      await tx.fnsRequest.deleteMany({ where: { customerId: id } });

      // 5) Receipts: detach customer
      await tx.receipt.updateMany({ where: { customerId: id }, data: { customerId: null } });

      // 6) Finally delete customer
      await tx.customer.delete({ where: { id } });
    });

    return { message: 'Customer deleted' };
  }

  async confirmByEmail(email: string) {
    const unconfirmed = await this.prisma.unconfirmedCustomer.findFirst({ where: { email } });
    if (!unconfirmed) {
      throw new NotFoundException('Customer not found');
    }
    const { id, confirmationToken, ...customer } = unconfirmed as any;
    await this.prisma.unconfirmedCustomer.delete({ where: { id } });
    await this.create(customer);
    return { message: 'User successfully confirmed', email: customer.email };
  }

  async getCustomerWithdrawalVariants(id: number) {
    const customer = await this.getOne(id);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return await this.withdrawalVariantsService.getAllByCustomerId(id);
  }
}
