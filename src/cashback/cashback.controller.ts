import { 
  Controller, 
  Get, 
  Put, 
  Param, 
  Body, 
  UseGuards, 
  Request,
  Query,
  ParseIntPipe,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CashbackService } from './cashback.service';
import { CancelCashbackDto } from './dto/cancel-cashback.dto';
import { CashbackHistoryItemDto } from './dto/cashback-history.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('Cashback Management')
@Controller('cashback')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class CashbackController {
  private readonly logger = new Logger(CashbackController.name);

  constructor(private readonly cashbackService: CashbackService) {}

  @Get('history/today')
  @ApiOperation({ 
    summary: 'Получить историю кэшбека за сегодня',
    description: 'Получает список всех начислений кэшбека за текущий день для администратора. Можно фильтровать по промоакции.'
  })
  @ApiQuery({
    name: 'promotionId',
    description: 'ID промоакции для фильтрации',
    required: false,
    type: String,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'История кэшбека успешно получена',
    type: [CashbackHistoryItemDto]
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Недостаточно прав доступа' 
  })
  async getTodaysCashbackHistory(
    @Query('promotionId') promotionId?: string,
    @Request() req?: any
  ): Promise<CashbackHistoryItemDto[]> {
    this.logger.log(`Getting today's cashback history for promotion: ${promotionId}`);
    
    try {
      // Проверяем, что пользователь - администратор
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
        throw new BadRequestException('Only administrators can access cashback history');
      }

      const history = await this.cashbackService.getTodaysCashbackHistory(promotionId);
      
      this.logger.log(`Retrieved ${history.length} cashback records`);
      return history as CashbackHistoryItemDto[];
    } catch (error) {
      this.logger.error('Error getting cashback history:', error);
      throw error;
    }
  }

  @Put(':id/cancel')
  @ApiOperation({ 
    summary: 'Отменить начисление кэшбека',
    description: 'Отменяет начисление кэшбека и списывает соответствующую сумму бонусов у клиента. Доступно только администраторам.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Кэшбек успешно отменен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        refundedAmount: { type: 'number' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Ошибка валидации или кэшбек уже отменен' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Недостаточно прав доступа' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Кэшбек не найден' 
  })
  async cancelCashback(
    @Param('id', ParseIntPipe) cashbackId: number,
    @Body() cancelDto: CancelCashbackDto,
    @Request() req: any
  ) {
    this.logger.log(`Cancelling cashback ${cashbackId} by admin ${req.user?.id}`);
    
    try {
      // Проверяем, что пользователь - администратор
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
        throw new BadRequestException('Only administrators can cancel cashback');
      }

      const result = await this.cashbackService.cancelCashback(
        cashbackId,
        req.user.id,
        cancelDto.reason
      );

      this.logger.log(`Successfully cancelled cashback ${cashbackId}`);
      return {
        ...result,
        message: `Кэшбек на сумму ${result.refundedAmount} копеек успешно отменен`
      };
    } catch (error) {
      this.logger.error(`Error cancelling cashback ${cashbackId}:`, error);
      throw error;
    }
  }

  @Get('customer/history')
  @ApiOperation({ 
    summary: 'Получить историю кэшбека для текущего клиента',
    description: 'Получает всю историю начислений кэшбека для авторизованного клиента с детализацией по товарам и акциям.'
  })
  @ApiQuery({
    name: 'promotionId',
    description: 'ID промоакции для фильтрации (необязательно)',
    required: false,
    type: String,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'История кэшбека клиента успешно получена',
    schema: {
      type: 'object',
      properties: {
        cashbacks: {
          type: 'array',
          items: { type: 'object' }
        },
        statistics: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            active: { type: 'number' },
            cancelled: { type: 'number' },
            totalAmount: { type: 'number' },
            cancelledAmount: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  async getCustomerCashbackHistory(
    @Request() req: any,
    @Query('promotionId') promotionId?: string,
  ) {
    const customerId = req.user?.id;
    if (!customerId) {
      throw new BadRequestException('User not authenticated');
    }

    this.logger.log(`Getting cashback history for customer ${customerId}, promotion: ${promotionId}`);
    return this.cashbackService.getCustomerCashbackHistory(customerId, promotionId);
  }

  @Get('details/:cashbackId')
  @ApiOperation({ 
    summary: 'Получить детальную информацию о кэшбеке',
    description: 'Получает подробную информацию о конкретном начислении кэшбека с товарами и акциями.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Детальная информация о кэшбеке успешно получена',
    type: Object
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Кэшбек не найден' 
  })
  async getCashbackDetails(
    @Param('cashbackId', ParseIntPipe) cashbackId: number,
    @Request() req: any,
  ) {
    const customerId = req.user?.id;
    this.logger.log(`Getting cashback details for ID ${cashbackId}, customer: ${customerId}`);
    
    // Для клиентов ограничиваем доступ только к их кэшбекам
    return this.cashbackService.getCashbackDetails(cashbackId, customerId);
  }

  @Get('stats/today')
  @ApiOperation({ 
    summary: 'Получить статистику кэшбека за сегодня',
    description: 'Получает агрегированную статистику по начислениям кэшбека за текущий день.'
  })
  @ApiQuery({
    name: 'promotionId',
    description: 'ID промоакции для фильтрации',
    required: false,
    type: String,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Статистика успешно получена',
    schema: {
      type: 'object',
      properties: {
        totalCashback: { type: 'number', description: 'Общая сумма кэшбека в копейках' },
        totalTransactions: { type: 'number', description: 'Количество транзакций' },
        activeCashback: { type: 'number', description: 'Сумма активного кэшбека' },
        cancelledCashback: { type: 'number', description: 'Сумма отмененного кэшбека' },
        uniqueCustomers: { type: 'number', description: 'Количество уникальных клиентов' },
        topOffers: { 
          type: 'array', 
          description: 'Топ акций по начислениям',
          items: {
            type: 'object',
            properties: {
              offerId: { type: 'number' },
              totalCashback: { type: 'number' },
              transactionCount: { type: 'number' }
            }
          }
        }
      }
    }
  })
  async getTodaysStats(
    @Query('promotionId') promotionId?: string,
    @Request() req?: any
  ) {
    this.logger.log(`Getting today's cashback stats for promotion: ${promotionId}`);
    
    try {
      // Проверяем, что пользователь - администратор
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
        throw new BadRequestException('Only administrators can access cashback statistics');
      }

      const history = await this.cashbackService.getTodaysCashbackHistory(promotionId);
      
      // Рассчитываем статистику
      const stats = {
        totalCashback: history.reduce((sum, item) => sum + item.amount, 0),
        totalTransactions: history.length,
        activeCashback: history.filter(item => item.status === 'active').reduce((sum, item) => sum + item.amount, 0),
        cancelledCashback: history.filter(item => item.status === 'cancelled').reduce((sum, item) => sum + item.amount, 0),
        uniqueCustomers: new Set(history.map(item => item.customer.id)).size,
        topOffers: this.calculateTopOffers(history)
      };

      this.logger.log(`Calculated stats: ${JSON.stringify(stats)}`);
      return stats;
    } catch (error) {
      this.logger.error('Error getting cashback stats:', error);
      throw error;
    }
  }

  /**
   * Вспомогательный метод для расчета топ акций
   */
  private calculateTopOffers(history: any[]) {
    const offerStats = new Map();

    history.forEach(cashback => {
      cashback.items.forEach((item: any) => {
        if (item.offerId) {
          const current = offerStats.get(item.offerId) || { 
            offerId: item.offerId, 
            totalCashback: 0, 
            transactionCount: 0 
          };
          
          current.totalCashback += item.cashbackAmount;
          current.transactionCount += 1;
          
          offerStats.set(item.offerId, current);
        }
      });
    });

    return Array.from(offerStats.values())
      .sort((a, b) => b.totalCashback - a.totalCashback)
      .slice(0, 10); // Топ 10 акций
  }
}