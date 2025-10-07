import { 
  Controller, 
  Get, 
  Put, 
  Post,
  Param, 
  Body, 
  Request,
  Query,
  ParseIntPipe,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CashbackService } from './cashback.service';
import { CashbackTicketsService } from './cashback-tickets.service';
import { CancelCashbackDto } from './dto/cancel-cashback.dto';
import { CashbackHistoryItemDto } from './dto/cashback-history.dto';
import { CreateCashbackTicketDto, UpdateCashbackTicketDto, CashbackTicketDto } from './dto/cashback-ticket.dto';

@ApiTags('Cashback Management')
@Controller('cashback')
@ApiBearerAuth()
export class CashbackController {
  private readonly logger = new Logger(CashbackController.name);

  constructor(
    private readonly cashbackService: CashbackService,
    private readonly cashbackTicketsService: CashbackTicketsService,
  ) {}

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
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
        throw new BadRequestException('Only administrators can access cashback history');
      }

      const history = await this.cashbackService.getTodaysCashbackHistory(promotionId);
      
      this.logger.log(`Retrieved ${history.length} cashback records`);
      return history;
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

  @Put(':id/confirm')
  @ApiOperation({ 
    summary: 'Подтвердить начисление кэшбека',
    description: 'Подтверждает начисление кэшбека и списывает соответствующую сумму бонусов у клиента. Доступно только администраторам.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Кэшбек успешно подтвержден',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        confirmedAmount: { type: 'number' },
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
  async confirmCashback(
    @Param('id', ParseIntPipe) cashbackId: number,
    @Request() req: any
  ) {
    this.logger.log(`Confirming cashback ${cashbackId} by admin ${req.user?.id}`);
    
    try {
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
        throw new BadRequestException('Only administrators can confirm cashback');
      }

      const result = await this.cashbackService.confirmCashback(
        cashbackId,
        req.user.id
      );

      this.logger.log(`Successfully confirmed cashback ${cashbackId}`);
      return {
        ...result,
        message: `Кэшбек на сумму ${result.confirmedAmount} копеек успешно подтвержден`
      };
    } catch (error) {
      this.logger.error(`Error confirming cashback ${cashbackId}:`, error);
      throw error;
    }
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
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
        throw new BadRequestException('Only administrators can access cashback statistics');
      }

      const history = await this.cashbackService.getTodaysCashbackHistory(promotionId);
      
      const stats = {
        totalCashback: history.reduce((sum, item) => sum + item.amount, 0),
        totalTransactions: history.length,
        activeCashback: history.reduce((sum, item) => sum + item.amount, 0),
        cancelledCashback: 0,
        uniqueCustomers: new Set(history.map(item => item.customerId)).size,
        topOffers: this.calculateTopOffers(history)
      };

      this.logger.log(`Calculated stats: ${JSON.stringify(stats)}`);
      return stats;
    } catch (error) {
      this.logger.error('Error getting cashback stats:', error);
      throw error;
    }
  }

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
      .slice(0, 10); 
  }

  @Post('tickets')
  @ApiOperation({ 
    summary: 'Создать заявку на вывод бонусов',
    description: 'Создает заявку на вывод указанного количества бонусов со статусом pending, чтобы администратор мог её рассмотреть.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Тикет успешно создан',
    type: CashbackTicketDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Ошибка валидации или тикет уже существует' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Кешбек не найден' 
  })
  async createTicket(
    @Body() createTicketDto: CreateCashbackTicketDto,
    @Request() req: any
  ): Promise<CashbackTicketDto> {
    const customerId = req.user?.id;
    this.logger.log(`Creating withdrawal ticket for amount ${createTicketDto.amount} by customer ${customerId}`);
    
    return this.cashbackTicketsService.createTicket(createTicketDto, customerId);
  }

  @Get('history/my')
  @ApiOperation({ 
    summary: 'Получить мою историю кешбеков',
    description: 'Получает все кешбеки текущего клиента (история начислений).'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'История кешбеков успешно получена',
    type: [CashbackHistoryItemDto]
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  async getMyCashbackHistory(@Request() req: any): Promise<any[]> {
    const customerId = req.user?.id;
    this.logger.log(`Getting cashback history for customer ${customerId}`);
    
    return this.cashbackService.getCustomerCashbackHistory(customerId);
  }

  @Get('tickets/my')
  @ApiOperation({ 
    summary: 'Получить мои тикеты',
    description: 'Получает все тикеты текущего клиента.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Тикеты успешно получены',
    type: [CashbackTicketDto]
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  async getMyTickets(@Request() req: any): Promise<CashbackTicketDto[]> {
    const customerId = req.user?.id;
    this.logger.log(`Getting tickets for customer ${customerId}`);
    
    return this.cashbackTicketsService.getCustomerTickets(customerId);
  }

  @Get('tickets')
  @ApiOperation({ 
    summary: 'Получить все тикеты (админ)',
    description: 'Получает все тикеты для администратора.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Тикеты успешно получены',
    type: [CashbackTicketDto]
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Недостаточно прав доступа' 
  })
  async getAllTickets(@Request() req: any): Promise<CashbackTicketDto[]> {
    if (req.user?.role !== 'ADMIN') {
      throw new BadRequestException('Only administrators can access all tickets');
    }
    
    this.logger.log(`Getting all tickets by admin ${req.user.id}`);
    return this.cashbackTicketsService.getAllTickets();
  }

  @Get('tickets/pending')
  @ApiOperation({ 
    summary: 'Получить ожидающие тикеты (админ)',
    description: 'Получает все тикеты со статусом pending для администратора.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Ожидающие тикеты успешно получены',
    type: [CashbackTicketDto]
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Недостаточно прав доступа' 
  })
  async getPendingTickets(@Request() req: any): Promise<CashbackTicketDto[]> {
    if (req.user?.role !== 'ADMIN') {
      throw new BadRequestException('Only administrators can access pending tickets');
    }
    
    this.logger.log(`Getting pending tickets by admin ${req.user.id}`);
    return this.cashbackTicketsService.getPendingTickets();
  }

  @Get('tickets/:id')
  @ApiOperation({ 
    summary: 'Получить тикет по ID',
    description: 'Получает детальную информацию о тикете по его ID.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Тикет успешно получен',
    type: CashbackTicketDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Тикет не найден' 
  })
  async getTicketById(
    @Param('id', ParseIntPipe) ticketId: number,
    @Request() req: any
  ): Promise<CashbackTicketDto> {
    this.logger.log(`Getting ticket ${ticketId} by user ${req.user?.id}`);
    return this.cashbackTicketsService.getTicketById(ticketId);
  }

  @Put('tickets/:id/status')
  @ApiOperation({ 
    summary: 'Обновить статус тикета (админ)',
    description: 'Обновляет статус тикета (approved/rejected) и соответствующий статус кешбека.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Статус тикета успешно обновлен',
    type: CashbackTicketDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Ошибка валидации или тикет уже обработан' 
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
    description: 'Тикет не найден' 
  })
  async updateTicketStatus(
    @Param('id', ParseIntPipe) ticketId: number,
    @Body() updateTicketDto: UpdateCashbackTicketDto,
    @Request() req: any
  ): Promise<CashbackTicketDto> {
    if (req.user?.role !== 'ADMIN') {
      throw new BadRequestException('Only administrators can update ticket status');
    }
    
    this.logger.log(`Updating ticket ${ticketId} status to ${updateTicketDto.status} by admin ${req.user.id}`);
    return this.cashbackTicketsService.updateTicketStatus(ticketId, updateTicketDto, req.user.id);
  }

}