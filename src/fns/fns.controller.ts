import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  UseGuards, 
  Request,
  Headers,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { FnsService } from './fns.service';
import { ScanQrCodeDto } from './dto/scan-qr-code.dto';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { ReceiptStatusDto } from './dto/receipt-status.dto';

@ApiTags('FNS Integration')
@Controller('fns')
export class FnsController {
  private readonly logger = new Logger(FnsController.name);

  constructor(private readonly fnsService: FnsService) {}

  @Post('scan-qr')
  @ApiOperation({ 
    summary: 'Сканировать QR код чека для конкретной сети аптек',
    description: 'Принимает QR код чека и токен авторизации. Из токена извлекается ID пользователя и ID сети для начисления кешбека в рамках конкретной промоакции.'
  })
  @ApiHeader({
    name: 'host',
    description: 'Поддомен сети аптек (например: р-фарм.чекпоинт.рф)',
    required: true,
  })
  @ApiBearerAuth()
  @ApiResponse({ 
    status: 200, 
    description: 'QR код успешно отправлен на обработку',
    schema: {
      type: 'object',
      properties: {
        requestId: { type: 'string', nullable: true },
        status: { type: 'string', enum: ['pending', 'rejected'] },
        message: { type: 'string' },
        network: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Неверные данные QR кода или превышен лимит'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ'
  })
  async scanQrCode(
    @Body() qrData: ScanQrCodeDto,
    @Request() req: any,
    @Headers('host') host: string,
  ) {
    this.logger.log(`QR scan request from host: ${host}, user: ${req.user?.id}`);
    
    if (!host) {
      throw new BadRequestException('Host header is required');
    }

    if (!req.user?.id) {
      throw new BadRequestException('User not authenticated');
    }

    if (!req.user?.promotionId) {
      throw new BadRequestException('Promotion ID not found in token');
    }

    return this.fnsService.processScanQrCode(
      qrData, 
      req.user.id, 
      req.user.promotionId, 
      host
    );
  }

  @Post('verify')
  @ApiOperation({ 
    summary: 'Проверить чек по QR коду (legacy метод)',
    description: 'Проверяет валидность чека и рассчитывает кешбек для общей системы (без привязки к конкретной сети)'
  })
  @ApiBearerAuth()
  @ApiResponse({ 
    status: 200, 
    description: 'Чек успешно отправлен на проверку',
    type: Object
  })
  async verifyReceipt(
    @Body() verifyReceiptDto: VerifyReceiptDto,
    @Request() req: any,
  ) {
    const customerId = req.user?.id;
    return this.fnsService.verifyReceipt(verifyReceiptDto, customerId);
  }

  @Get('status/:requestId')
  @ApiOperation({ 
    summary: 'Получить статус обработки запроса',
    description: 'Возвращает текущий статус обработки запроса на проверку чека в ФНС'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Статус запроса',
    type: ReceiptStatusDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Запрос не найден'
  })
  async getRequestStatus(@Param('requestId') requestId: string) {
    return this.fnsService.getRequestStatus(requestId);
  }

  @Get('queue/stats')
  @ApiOperation({ 
    summary: 'Получить статистику очереди обработки',
    description: 'Возвращает статистику по очереди запросов к ФНС'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Статистика очереди',
    schema: {
      type: 'object',
      properties: {
        pending: { type: 'number' },
        processing: { type: 'number' },
        success: { type: 'number' },
        failed: { type: 'number' },
        total: { type: 'number' }
      }
    }
  })
  async getQueueStats() {
    return this.fnsService.getQueueStats();
  }

  @Get('daily-count')
  @ApiOperation({ 
    summary: 'Получить количество запросов за сегодня',
    description: 'Возвращает количество запросов к ФНС API за текущий день'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Количество запросов за день',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' },
        limit: { type: 'number' }
      }
    }
  })
  async getDailyRequestCount() {
    const count = await this.fnsService.getDailyRequestCount();
    return {
      count,
      limit: 1000 // ФНС лимит из документации
    };
  }

  @Get('test/connection')
  @ApiOperation({ 
    summary: 'Тестировать подключение к ФНС API',
    description: 'Проверяет доступность ФНС API и возможность аутентификации'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Результат тестирования подключения',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        ip: { type: 'string' },
        timestamp: { type: 'string' },
        authTest: { type: 'object' },
        serviceTest: { type: 'object' }
      }
    }
  })
  async testFnsConnection() {
    return this.fnsService.testFnsConnection();
  }

  @Post('test/qr')
  @ApiOperation({ 
    summary: 'Тестировать QR код с примером из документации',
    description: 'Отправляет тестовый QR код из документации ФНС для проверки работоспособности'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Результат тестирования QR кода',
    type: Object
  })
  async testQrCode() {
    // Пример QR данных из документации ФНС
    const testQrData = {
      fn: '9287440300090728',
      fd: '77133',
      fp: '1482926127',
      sum: 240000, // 2400 рублей в копейках
      date: '2019-04-09T16:38:00',
      typeOperation: 1
    };

    return this.fnsService.testQrProcessing(testQrData);
  }
} 