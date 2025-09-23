import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateCustomerDto } from 'src/customers/dto/create-customer.dto';
import { MailerService } from 'src/mailer/mailer.service';
import { v4 as uuidv4 } from 'uuid';
import { PromotionsService } from 'src/promotions/promotions.service';
import { CreateUnconfirmedCustomerDto } from 'src/customers/dto/unconfirmed-customer.dto';
import { UnconfirmedCustomersService } from 'src/customers/unconfirmed-customers.service';
import { CustomersService } from 'src/customers/customers.service';
import { LoginCustomerDto } from 'src/customers/dto/login-customer.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthService } from './auth.service';
import { RegistrationResponseDto } from './dto/registration-response.dto';
import { ConfirmationResponseDto } from './dto/confirmation-response.dto';

@Injectable()
export class AuthCustomerService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly promotionsService: PromotionsService,
    private readonly unconfirmedCustomersService: UnconfirmedCustomersService,
    private readonly customersService: CustomersService,
    private readonly authService: AuthService,
  ) {}

  async regCustomer(createCustomerDto: CreateCustomerDto): Promise<RegistrationResponseDto> {
    const hashedPassword = await bcrypt.hash(createCustomerDto.password, +process.env.SALT);

    const promotion = await this.promotionsService.findOneByPromotionId(
      createCustomerDto.promotionId,
    );

    if (!promotion) {
      throw new NotFoundException(
        `Promotion with promotionId:${createCustomerDto.promotionId} not found`,
      );
    }

    const confirmationToken = uuidv4();

    const customer: CreateUnconfirmedCustomerDto = {
      ...createCustomerDto,
      confirmationToken,
      password: hashedPassword,
    };

    const createdCustomer = await this.unconfirmedCustomersService.createUnconfirmed(customer);

    const siteLink = `https://xn----itbkgreg1a1b.xn--p1ai/auth/confirm/${createdCustomer.confirmationToken}`;

    const res = await this.mailerService.sendMail({
      subject: 'Подтверждение регистрации',
      html: `Для подтверждения почты перейдите по ссылке: <a href="${siteLink}">Подтвердить</a>`,
      to: createCustomerDto.email,
    });

    if (res.isError) {
      throw new InternalServerErrorException('Failed to send confirmation email.');
    }

    return {
      message: 'Registration request has been created',
      confirmationToken: createdCustomer.confirmationToken,
      confirmationLink: siteLink,
    };
  }

  async confirmCustomer(confirmationToken: string): Promise<ConfirmationResponseDto> {
    const unconfirmed =
      await this.unconfirmedCustomersService.getUnconfirmedByConfirmationToken(confirmationToken);

    if (!unconfirmed) {
      throw new NotFoundException('Customer not found');
    }
    const { confirmationToken: token, id, ...customer } = unconfirmed;

    await this.unconfirmedCustomersService.remove(id);

    await this.customersService.create(customer);

    return {
      message: 'User successfully confirmed',
      email: customer.email,
    };
  }

  async loginCustomer(loginCustomerDto: LoginCustomerDto): Promise<LoginResponseDto> {
    console.log('🔍 Поиск пользователя:', { email: loginCustomerDto.email, promotionId: loginCustomerDto.promotionId });
    
    const customer = await this.customersService.getCustomerByEmailAndPromotionId(
      loginCustomerDto.email,
      loginCustomerDto.promotionId,
    );
    
    if (!customer) {
      console.log('❌ Пользователь не найден');
      throw new NotFoundException('Customer not found');
    }
    
    console.log('✅ Пользователь найден:', { id: customer.id, email: customer.email });
    
    const isMatch = await bcrypt.compare(loginCustomerDto.password, customer.password);
    console.log('🔐 Проверка пароля:', { isMatch });

    if (!isMatch) {
      console.log('❌ Неверный пароль');
      throw new UnauthorizedException();
    }

    const payload = { 
      id: customer.id, 
      email: customer.email, 
      role: customer.role,
      promotionId: customer.promotionId,
      name: customer.name,
      surname: customer.surname
    };
    
    console.log('🎫 Создание payload для токена:', payload);

    try {
      const tokens = await this.authService.getTokensByPayload(payload);
      console.log('✅ Токены успешно созданы');
      return tokens;
    } catch (error) {
      console.log('❌ Ошибка при создании токенов:', error);
      throw error;
    }
  }
}
