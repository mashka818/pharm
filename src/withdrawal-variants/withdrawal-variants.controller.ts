import { Controller, Delete, Param, Request } from '@nestjs/common';
import { WithdrawalVariantsService } from './withdrawal-variants.service';
import { IRequestWithUser } from 'src/auth/types/all-users.type';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Withdrawal variants')
@Controller('withdrawal-variants')
export class WithdrawalVariantsController {
  constructor(private readonly withdrawalVariantsService: WithdrawalVariantsService) {}

  @ApiOperation({ summary: 'Удалить вариант вывода', description: 'Удаляет вариант вывода средств по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Вариант вывода успешно удалён' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Вариант вывода не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Delete(':id')
  removeWithdrawalVariant(@Param('id') id: number, @Request() req: IRequestWithUser) {
    const user = req.user;
    return this.withdrawalVariantsService.remove(id, user.id);
  }
}
