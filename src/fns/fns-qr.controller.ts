import { Controller, Post, Body, Headers, BadRequestException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { FnsQrParserService } from './fns-qr-parser.service';
import { FnsNetworkService } from './fns-network.service';
import { FnsService } from './fns.service';
import { AuthService } from '../auth/auth.service';
import { ScanQrDto } from './dto/scan-qr.dto';

@ApiTags('FNS QR Code Processing')
@Controller('fns/qr')
export class FnsQrController {
  private readonly logger = new Logger(FnsQrController.name);

  constructor(
    private readonly fnsQrParserService: FnsQrParserService,
    private readonly fnsNetworkService: FnsNetworkService,
    private readonly fnsService: FnsService,
    private readonly authService: AuthService,
  ) {}

  @Post('scan')
  @ApiOperation({ summary: 'Scan QR code and process receipt' })
  @ApiResponse({ status: 200, description: 'QR code processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid QR code or token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiHeader({ name: 'Host', description: 'Subdomain for network identification' })
  async scanQrCode(
    @Body() scanQrDto: ScanQrDto,
    @Headers('host') host: string,
  ) {
    this.logger.log(`Processing QR scan for host: ${host}`);

    try {
      // Извлекаем поддомен из заголовка Host
      const subdomain = this.extractSubdomain(host);
      if (!subdomain) {
        throw new BadRequestException('Неверный поддомен');
      }

      // Получаем сеть по поддомену
      const network = await this.fnsNetworkService.getNetworkBySubdomain(subdomain);
      if (!network) {
        throw new BadRequestException('Сеть не найдена для данного поддомена');
      }

      // Валидируем токен и получаем пользователя
      const user = await this.authService.validateToken(scanQrDto.token);
      if (!user) {
        throw new BadRequestException('Неверный токен');
      }

      // Проверяем, что токен содержит ID сети
      if (user.networkId && user.networkId !== network.id) {
        throw new BadRequestException('Токен не соответствует сети');
      }

      // Валидируем QR-код
      if (!this.fnsQrParserService.validateQrCode(scanQrDto.qrCode)) {
        throw new BadRequestException('Неверный формат QR-кода');
      }

      // Парсим QR-код
      const qrData = this.fnsQrParserService.parseQrCode(scanQrDto.qrCode);

      // Проверяем, не был ли уже обработан этот чек
      const existingRequest = await this.checkExistingReceipt(qrData, user.id);
      if (existingRequest) {
        return {
          requestId: existingRequest.id,
          status: existingRequest.status,
          cashbackAmount: existingRequest.cashbackAmount,
          cashbackAwarded: existingRequest.cashbackAwarded,
          message: 'Чек уже был обработан',
        };
      }

      // Добавляем данные сети к QR-данным
      const enrichedQrData = {
        ...qrData,
        networkId: network.id,
        networkName: network.name,
        additionalData: scanQrDto.additionalData,
      };

      // Отправляем на проверку в ФНС
      const result = await this.fnsService.verifyReceipt(enrichedQrData, user.id);

      this.logger.log(`QR scan completed for user ${user.id}, network ${network.id}`);
      
      return {
        ...result,
        networkId: network.id,
        networkName: network.name,
      };

    } catch (error) {
      this.logger.error('Error processing QR scan:', error);
      throw error;
    }
  }

  private extractSubdomain(host: string): string | null {
    if (!host) return null;

    // Убираем порт если есть
    const hostWithoutPort = host.split(':')[0];
    
    // Проверяем, что это поддомен (не основной домен)
    const parts = hostWithoutPort.split('.');
    if (parts.length >= 3) {
      return parts[0]; // Первая часть - поддомен
    }
    
    return null;
  }

  private async checkExistingReceipt(qrData: any, customerId: number): Promise<any> {
    try {
      const existingRequest = await this.fnsService.getRequestByQrData(qrData, customerId);
      return existingRequest;
    } catch (error) {
      return null;
    }
  }
}