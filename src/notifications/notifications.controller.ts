import { 
  Controller, 
  Get, 
  Put, 
  Delete,
  Param, 
  Body,
  Request,
  Query,
  ParseBoolPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CustomerNotificationDto, MarkAsReadDto } from './dto/customer-notification.dto';

@ApiTags('Customer Notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Получить уведомления клиента',
    description: 'Получает все уведомления текущего клиента с возможностью фильтрации только непрочитанных'
  })
  @ApiQuery({
    name: 'onlyUnread',
    description: 'Получить только непрочитанные уведомления',
    required: false,
    type: Boolean,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Уведомления успешно получены',
    type: [CustomerNotificationDto]
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  async getMyNotifications(
    @Request() req: any,
    @Query('onlyUnread', new ParseBoolPipe({ optional: true })) onlyUnread?: boolean
  ): Promise<CustomerNotificationDto[]> {
    const customerId = req.user?.id;
    return this.notificationsService.getCustomerNotifications(customerId, onlyUnread || false);
  }

  @Get('unread/count')
  @ApiOperation({ 
    summary: 'Получить количество непрочитанных уведомлений',
    description: 'Возвращает количество непрочитанных уведомлений для текущего клиента'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Количество успешно получено',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  async getUnreadCount(@Request() req: any): Promise<{ count: number }> {
    const customerId = req.user?.id;
    const count = await this.notificationsService.getUnreadCount(customerId);
    return { count };
  }

  @Put('read')
  @ApiOperation({ 
    summary: 'Отметить уведомления как прочитанные',
    description: 'Отмечает указанные уведомления как прочитанные'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Уведомления успешно отмечены как прочитанные',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  async markAsRead(@Body() markAsReadDto: MarkAsReadDto): Promise<{ count: number }> {
    return this.notificationsService.markAsRead(markAsReadDto.notificationIds);
  }

  @Put('read/all')
  @ApiOperation({ 
    summary: 'Отметить все уведомления как прочитанные',
    description: 'Отмечает все непрочитанные уведомления клиента как прочитанные'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Все уведомления успешно отмечены как прочитанные',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  async markAllAsRead(@Request() req: any): Promise<{ count: number }> {
    const customerId = req.user?.id;
    return this.notificationsService.markAllAsRead(customerId);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Удалить уведомление',
    description: 'Удаляет указанное уведомление'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Уведомление успешно удалено',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Уведомление не найдено' 
  })
  async deleteNotification(
    @Param('id') notificationId: string,
    @Request() req: any
  ): Promise<{ success: boolean }> {
    const customerId = req.user?.id;
    await this.notificationsService.deleteNotification(notificationId, customerId);
    return { success: true };
  }
}

