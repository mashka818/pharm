import { Body, Controller, Get, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { IRequestWithUser } from 'src/auth/types/all-users.type';
import { WithdrawalVariantsService } from 'src/withdrawal-variants/withdrawal-variants.service';
import { CreateWithdrawalVariantDto } from 'src/withdrawal-variants/dto/create-withdrawal-variant.dto';
import { UpdateCustomerDto } from './dto/update-customer-dto';
import { ApiBody, ApiResponse, ApiTags, OmitType, PickType, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerDto } from './dto/customer.dto';
import { UpdateWithdrawalVariantDto } from 'src/withdrawal-variants/dto/update-withdrawal-variant.dto';
import { CustomersUpdateService } from './customers-update.service';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { confirmEmailDto, UpdateEmailDto } from './dto/update-email.dto';
import { LoginResponseDto } from 'src/auth/dto/login-response.dto';

@ApiBearerAuth()
@ApiTags('Customer')
@Controller('customers')
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customersUpdateService: CustomersUpdateService,
    private readonly withdrawalVariantsService: WithdrawalVariantsService,
  ) {}

  @ApiOperation({ summary: 'Получить данные о себе', description: 'Возвращает данные текущего авторизованного клиента.' })
  @ApiResponse({ status: 200, description: 'Данные клиента', type: CustomerDto })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get('/me')
  getMe(@Request() req: IRequestWithUser) {
    const user = req.user;
    return this.customersService.getOne(user.id);
  }

  @ApiOperation({ summary: 'Получить схемы вывода средств', description: 'Возвращает список всех схем вывода средств текущего клиента.' })
  @ApiResponse({ status: 200, description: 'Список схем вывода средств', type: [UpdateWithdrawalVariantDto] })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get('/me/withdrawal-variants')
  getMyWithdrawalVariants(@Request() req: IRequestWithUser) {
    const user = req.user;
    return this.customersService.getCustomerWithdrawalVariants(user.id);
  }

  @ApiOperation({ summary: 'Создать схему вывода средств', description: 'Создаёт новую схему вывода средств для текущего клиента.' })
  @ApiResponse({ status: 201, description: 'Схема успешно создана', type: UpdateWithdrawalVariantDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 409, description: 'Схема с такими параметрами уже существует' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: CreateWithdrawalVariantDto })
  @Post('/me/withdrawal-variants')
  createMyWithdrawalVariant(
    @Request() req: IRequestWithUser,
    @Body() createWithdrawalVariantDto: CreateWithdrawalVariantDto,
  ) {
    const user = req.user;
    return this.withdrawalVariantsService.create(createWithdrawalVariantDto, user.id);
  }

  @ApiOperation({ summary: 'Обновить данные о себе', description: 'Обновляет данные текущего клиента.' })
  @ApiResponse({ status: 200, description: 'Данные клиента успешно обновлены', type: CustomerDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: OmitType(UpdateCustomerDto, ['promotionId', 'password', 'email']) })
  @Patch('me')
  updateMe(@Request() req: IRequestWithUser, @Body() updateCustomerDto: UpdateCustomerDto) {
    const user = req.user;
    return this.customersUpdateService.updateOne(updateCustomerDto, user.id);
  }

  @ApiOperation({ summary: 'Обновить пароль', description: 'Обновляет пароль текущего клиента.' })
  @ApiResponse({ status: 200, description: 'Пароль успешно обновлён' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: UpdatePasswordDto })
  @Patch('me/password')
  updateMyPassword(@Request() req: IRequestWithUser, @Body() updatePasswordDto: UpdatePasswordDto) {
    const user = req.user;
    return this.customersUpdateService.updatePassword(
      updatePasswordDto.prevPassword,
      updatePasswordDto.newPassword,
      user.id,
    );
  }

  @ApiOperation({ summary: 'Обновить email', description: 'Обновляет email текущего клиента.' })
  @ApiResponse({ status: 200, description: 'Email успешно обновлён' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: UpdateEmailDto })
  @Post('me/email')
  updateMyEmail(@Request() req: IRequestWithUser, @Body() { email }: { email: string }) {
    const user = req.user;
    return this.customersUpdateService.updateEmail(email, user.id);
  }

  @ApiOperation({ summary: 'Подтвердить email', description: 'Подтверждает email текущего клиента по токену.' })
  @ApiResponse({ status: 200, description: 'Email успешно подтверждён', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: confirmEmailDto })
  @Post('me/email/confirm')
  confirmMyEmail(@Request() req: IRequestWithUser, @Body() { token }: { token: string }) {
    const user = req.user;
    return this.customersUpdateService.confirmEmail(token, user.id);
  }
}
