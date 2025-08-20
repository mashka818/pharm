import { 
  Controller, 
  Get, 
  Put, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  ParseBoolPipe,
  ParseIntPipe,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminNotificationService } from './admin-notification.service';
import { AdminNotificationDto, ScanningStatsDto } from './dto/admin-notification.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('Admin Notifications & Stats')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class AdminNotificationController {
  private readonly logger = new Logger(AdminNotificationController.name);

  constructor(private readonly adminNotificationService: AdminNotificationService) {}

  @Get('notifications')
  @ApiOperation({ 
    summary: 'Получить уведомления для администратора',
    description: 'Получает список уведомлений о подозрительной активности, повторных сканированиях и т.д.'
  })
  @ApiQuery({
    name: 'promotionId',
    description: 'ID промоакции для фильтрации',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'isRead',
    description: 'Фильтр по прочитанным уведомлениям',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Количество уведомлений',
    required: false,
    type: Number,
    example: 50,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Список уведомлений',
    type: [AdminNotificationDto]
  })
  async getNotifications(
    @Query('promotionId') promotionId?: string,
    @Query('isRead', new ParseBoolPipe({ optional: true })) isRead?: boolean,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Request() req?: any
  ): Promise<AdminNotificationDto[]> {
    this.logger.log(`Getting notifications for user ${req.user?.id}, role: ${req.user?.role}`);
    
    // Проверяем права доступа
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
      throw new BadRequestException('Only administrators can access notifications');
    }

    // Если это администратор подсети (COMPANY), показываем только уведомления его подсети
    const filterPromotionId = req.user?.role === 'COMPANY' ? req.user?.promotionId : promotionId;

    return this.adminNotificationService.getNotifications(
      filterPromotionId,
      isRead,
      limit || 50
    );
  }

  @Put('notifications/:id/read')
  @ApiOperation({ 
    summary: 'Отметить уведомление как прочитанное',
    description: 'Отмечает конкретное уведомление как прочитанное'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Уведомление отмечено как прочитанное'
  })
  async markAsRead(
    @Param('id') notificationId: string,
    @Request() req?: any
  ): Promise<{ success: boolean }> {
    // Проверяем права доступа
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
      throw new BadRequestException('Only administrators can mark notifications as read');
    }

    await this.adminNotificationService.markAsRead(notificationId);
    return { success: true };
  }

  @Put('notifications/read-all')
  @ApiOperation({ 
    summary: 'Отметить все уведомления как прочитанные',
    description: 'Отмечает все непрочитанные уведомления как прочитанные'
  })
  @ApiQuery({
    name: 'promotionId',
    description: 'ID промоакции для фильтрации',
    required: false,
    type: String,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Количество отмеченных уведомлений',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        markedCount: { type: 'number' }
      }
    }
  })
  async markAllAsRead(
    @Query('promotionId') promotionId?: string,
    @Request() req?: any
  ): Promise<{ success: boolean; markedCount: number }> {
    // Проверяем права доступа
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
      throw new BadRequestException('Only administrators can mark notifications as read');
    }

    // Если это администратор подсети (COMPANY), отмечаем только уведомления его подсети
    const filterPromotionId = req.user?.role === 'COMPANY' ? req.user?.promotionId : promotionId;

    const markedCount = await this.adminNotificationService.markAllAsRead(filterPromotionId);
    return { success: true, markedCount };
  }

  @Get('notifications/unread-count')
  @ApiOperation({ 
    summary: 'Получить количество непрочитанных уведомлений',
    description: 'Возвращает количество непрочитанных уведомлений для администратора'
  })
  @ApiQuery({
    name: 'promotionId',
    description: 'ID промоакции для фильтрации',
    required: false,
    type: String,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Количество непрочитанных уведомлений',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' }
      }
    }
  })
  async getUnreadCount(
    @Query('promotionId') promotionId?: string,
    @Request() req?: any
  ): Promise<{ count: number }> {
    // Проверяем права доступа
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
      throw new BadRequestException('Only administrators can access notification count');
    }

    // Если это администратор подсети (COMPANY), считаем только уведомления его подсети
    const filterPromotionId = req.user?.role === 'COMPANY' ? req.user?.promotionId : promotionId;

    const count = await this.adminNotificationService.getUnreadCount(filterPromotionId);
    return { count };
  }

  @Get('stats/scanning')
  @ApiOperation({ 
    summary: 'Получить статистику сканирования чеков',
    description: 'Возвращает детальную статистику по сканированию чеков: ИНН, время, успешность и т.д.'
  })
  @ApiQuery({
    name: 'promotionId',
    description: 'ID промоакции для фильтрации (только для рут-админов)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Дата начала периода (ISO string)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'toDate',
    description: 'Дата окончания периода (ISO string)',
    required: false,
    type: String,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Статистика сканирования',
    type: ScanningStatsDto
  })
  async getScanningStats(
    @Query('promotionId') promotionId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Request() req?: any
  ): Promise<ScanningStatsDto> {
    this.logger.log(`Getting scanning stats for user ${req.user?.id}, role: ${req.user?.role}`);
    
    // Проверяем права доступа
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMPANY') {
      throw new BadRequestException('Only administrators can access scanning statistics');
    }

    // Для администраторов подсети (COMPANY) показываем только их статистику
    let filterPromotionId = promotionId;
    if (req.user?.role === 'COMPANY') {
      filterPromotionId = req.user?.promotionId;
      this.logger.log(`Company admin - filtering by promotion: ${filterPromotionId}`);
    }

    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    return this.adminNotificationService.getScanningStats(filterPromotionId, from, to);
  }
}
