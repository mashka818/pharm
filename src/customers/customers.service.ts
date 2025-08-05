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

  async getCustomerWithdrawalVariants(id: number) {
    const customer = await this.getOne(id);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return await this.withdrawalVariantsService.getAllByCustomerId(id);
  }
}
