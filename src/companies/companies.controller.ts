import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ApiBody, ApiResponse, ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@ApiTags('Company')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @ApiOperation({ summary: 'Создать компанию', description: 'Создаёт нового пользователя компании.' })
  @ApiResponse({ status: 201, description: 'Пользователь компании успешно создан', type: UpdateCompanyDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 409, description: 'Пользователь с таким именем уже существует' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: CreateCompanyDto })
  @Post()
  createCompany(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @ApiOperation({ summary: 'Получить всех пользователей компаний', description: 'Возвращает список всех пользователей компаний.' })
  @ApiResponse({ status: 200, description: 'Список пользователей компаний', type: [UpdateCompanyDto] })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get()
  getAllCompanies() {
    return this.companiesService.getAll();
  }

  @ApiOperation({ summary: 'Получить пользователя компании по ID', description: 'Возвращает данные пользователя компании по его идентификатору.' })
  @ApiResponse({ status: 200, description: 'Данные пользователя компании', type: UpdateCompanyDto })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Пользователь компании не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get(':id')
  getOneCompany(@Param('id') id: string) {
    return this.companiesService.getOne(+id);
  }

  @ApiOperation({ summary: 'Обновить пользователя компании', description: 'Обновляет данные пользователя компании.' })
  @ApiResponse({ status: 200, description: 'Пользователь компании успешно обновлён', type: UpdateCompanyDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Пользователь компании не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: UpdateCompanyDto })
  @Put(':id')
  updateCompany(@Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(updateCompanyDto);
  }

  @ApiOperation({ summary: 'Удалить пользователя компании', description: 'Удаляет пользователя компании по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Пользователь компании успешно удалён' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Пользователь компании не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Delete(':id')
  removeCompany(@Param('id') id: string) {
    return this.companiesService.remove(+id);
  }
}
