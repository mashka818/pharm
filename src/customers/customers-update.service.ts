import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer-dto';
import { CustomerDto } from './dto/customer.dto';
import * as bcrypt from 'bcrypt';
import { MailerService } from 'src/mailer/mailer.service';
import { v4 as uuidv4 } from 'uuid';
import { LoginResponseDto } from 'src/auth/dto/login-response.dto';
import { AuthService } from 'src/auth/auth.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CustomersUpdateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly authService: AuthService,
    private readonly mailerService: MailerService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async clearUnconfirmed() {
    const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
    const emails = await this.prisma.unconfirmedEmail.deleteMany({
      where: {
        createdAt: {
          lt: halfHourAgo,
        },
      },
    });
    console.log('clean unconfirmed emails');
    return emails;
  }

  async updateOne(updateCustomerDto: UpdateCustomerDto, id: number): Promise<CustomerDto> {
    await this.customersService.getOne(id);

    if (updateCustomerDto.password || updateCustomerDto.promotionId || updateCustomerDto.email) {
      throw new BadRequestException('Cannot update password, promotionId and email');
    }

    const updatedCustomer = await this.prisma.customer.update({
      where: { id: id },
      data: updateCustomerDto,
    });
    const { password, ...restCustomer } = updatedCustomer;
    return restCustomer;
  }

  async updateEmail(email: string, id: number) {
    const customer = await this.customersService.getOne(id);
    if (email !== customer.email) {
      const sameEmailCustomers = await this.customersService.getAllByEmail(email);
      sameEmailCustomers.forEach((obj) => {
        if (
          obj.email === email &&
          obj.promotionId === customer.promotionId &&
          obj.id !== customer.id
        ) {
          throw new BadRequestException('User with this email already exist in this promotion');
        }
      });

      const confirmationToken = uuidv4();

      await this.prisma.unconfirmedEmail.create({ data: { email, confirmationToken } });

      const confirmationLink = `${process.env.FRONTEND_URL}/auth/confirm/${confirmationToken}`;

      const res = await this.mailerService.sendMail({
        subject: 'Подтверждение смены почты',
        html: `Для подтверждения смены почты перейдите по следующей ссылке: <a href="${confirmationLink}">Подтвердить почту</a>`,
        to: email,
      });

      if (res.isError) {
        throw new InternalServerErrorException('Failed to send confirmation email.');
      }

      return 'Change email request has been created';
    }
  }

  async confirmEmail(confirmationToken: string, id: number): Promise<LoginResponseDto> {
    if (!id) {
      throw new UnauthorizedException();
    }
    const customer = await this.customersService.getOne(id);

    const emailObj = await this.prisma.unconfirmedEmail.findUnique({
      where: { confirmationToken },
    });
    if (!emailObj) {
      throw new BadRequestException('Request with this email not exist or expired');
    }

    await this.prisma.unconfirmedEmail.delete({ where: { confirmationToken } });

    await this.prisma.customer.update({ where: { id }, data: { email: emailObj.email } });

    const payload = { id: customer.id, username: emailObj.email, role: customer.role };

    return await this.authService.getTokensByPayload(payload);
  }

  async updatePassword(prevPassword: string, newPassword: string, id: number) {
    const customer = await this.customersService.getOne(id, true);

    const isMatch = await bcrypt.compare(prevPassword, customer.password);

    if (!isMatch) {
      throw new UnauthorizedException();
    }

    const password = await bcrypt.hash(newPassword, +process.env.SALT);

    await this.prisma.customer.update({
      where: { id: id },
      data: { password },
    });

    return 'Password has been updates';
  }
}
