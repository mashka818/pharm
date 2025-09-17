import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Public } from 'src/decorators/public.decorator';
import { ApiResponse, ApiParam } from '@nestjs/swagger';
import { ConfirmationResponseDto } from 'src/auth/dto/confirmation-response.dto';
import { AuthCustomerService } from 'src/auth/auth-customer.service';
import { AdminsService } from './admins.service';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { LoginAdminDto } from './dto/login-admin.dto';
import { UserOwnershipGuard } from 'src/auth/guards/user-ownership.guard';
import { ApiBody, ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { CustomersService } from 'src/customers/customers.service';
import { ApiOkResponse } from '@nestjs/swagger';

@ApiBearerAuth()
@UseGuards(AdminGuard)
@ApiTags('Admin')
@Controller('admins')
export class AdminsController {
  constructor(
    private readonly adminsService: AdminsService, 
    private readonly authCustomerService: AuthCustomerService,
    private readonly customersService: CustomersService,
  ) {}
  @ApiOperation({ summary: 'Список всех пользователей' })
  @ApiOkResponse({ description: 'Успешно', isArray: true })
  @Get('customers')
  getAllCustomers() {
    return this.customersService.getAll();
  }

  @ApiOperation({ summary: 'Удалить пользователя по ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Пользователь удалён' })
  @Delete('customers/:id')
  removeCustomer(@Param('id') id: number) {
    return this.customersService.remove(Number(id));
  }

  getAdminByUsername(username: LoginAdminDto['username']) {
    return this.adminsService.getAdminByUsername(username);
  }

  @ApiOperation({ summary: 'Создать администратора', description: 'Создаёт нового администратора в системе.' })
  @ApiResponse({ status: 201, description: 'Администратор успешно создан', type: UpdateAdminDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 409, description: 'Администратор с таким именем уже существует' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: LoginAdminDto })
  @Post()
  createAdmin(@Body() adminDto: LoginAdminDto) {
    return this.adminsService.create(adminDto);
  }

  @ApiOperation({ summary: 'Подтвердить пользователя по токену' })
  @ApiResponse({ status: 200, description: 'Пользователь успешно подтвержден', type: ConfirmationResponseDto })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  @Post('confirm-customer/:confirmationToken')
  confirmCustomer(@Param('confirmationToken') confirmationToken: string) {
    return this.authCustomerService.confirmCustomer(confirmationToken);
  }

  @ApiOperation({ summary: 'Подтвердить пользователя по email' })
  @ApiResponse({ status: 200, description: 'Пользователь успешно подтвержден', type: ConfirmationResponseDto })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  @Post('confirm-customer-by-email/:email')
  async confirmCustomerByEmail(@Param('email') email: string) {
    return this.customersService.confirmByEmail(email);
  }

  @ApiOperation({ summary: 'Получить администратора по ID', description: 'Возвращает данные администратора по его идентификатору.' })
  @ApiResponse({ status: 200, description: 'Данные администратора', type: UpdateAdminDto })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Администратор не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get(':id')
  getOneAdmin(@Param('id') id: number) {
    return this.adminsService.getOne(+id);
  }

  @ApiOperation({ summary: 'Получить всех администраторов', description: 'Возвращает список всех администраторов.' })
  @ApiResponse({ status: 200, description: 'Список администраторов', type: [UpdateAdminDto] })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get()
  getAllAdmins() {
    return this.adminsService.getAll();
  }

  @ApiOperation({ summary: 'Обновить администратора', description: 'Обновляет данные администратора.' })
  @ApiResponse({ status: 200, description: 'Администратор успешно обновлён', type: UpdateAdminDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Администратор не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: UpdateAdminDto })
  @UseGuards(UserOwnershipGuard)
  @Put(':id')
  updateAdmin(@Body() updateAdminDto: UpdateAdminDto) {
    return this.adminsService.update(updateAdminDto);
  }

  @ApiOperation({ summary: 'Удалить администратора', description: 'Удаляет администратора по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Администратор успешно удалён' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Администратор не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Delete(':id')
  removeAdmin(@Param('id') id: number) {
    return this.adminsService.remove(+id);
  }
}
