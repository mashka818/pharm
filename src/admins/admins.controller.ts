import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminsService } from './admins.service';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { LoginAdminDto } from './dto/login-admin.dto';
import { UserOwnershipGuard } from 'src/auth/guards/user-ownership.guard';
import { ApiBody, ApiResponse, ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateAdminDto } from './dto/update-admin.dto';

@ApiBearerAuth()
@UseGuards(AdminGuard)
@ApiTags('Admin')
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

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
