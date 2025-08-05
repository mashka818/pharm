import { Controller, Post, Get, Body, Param, Request, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { FnsService } from './fns.service';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { ReceiptStatusDto } from './dto/receipt-status.dto';
import { ScanQrCodeDto } from './dto/scan-qr-code.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RequestWithTenant } from '../auth/middleware/tenant.middleware';

@ApiTags('FNS Receipt Verification')
@Controller('receipt')
export class FnsController {
  constructor(private readonly fnsService: FnsService) {}

  @Post('scan-qr')
  @ApiOperation({ 
    summary: 'Scan QR code receipt for cashback',
    description: 'Accepts QR code data and JWT token with embedded network ID'
  })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token with user and network ID',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'QR scan successful, cashback processing started' })
  @ApiResponse({ status: 400, description: 'Invalid QR data or token' })
  @ApiResponse({ status: 401, description: 'Invalid or missing token' })
  @UseGuards(AuthGuard)
  async scanQrCode(
    @Body() scanData: ScanQrCodeDto,
    @Request() req: RequestWithTenant,
    @Headers('host') host: string,
  ) {
    const customerId = req.user?.id;
    const promotionId = req.user?.promotionId || req.tenant?.promotionId;
    
    return this.fnsService.processScanQrCode(scanData, customerId, promotionId, host);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify receipt using QR code data' })
  @ApiResponse({ status: 200, description: 'Receipt verification started' })
  @ApiResponse({ status: 400, description: 'Invalid QR data' })
  async verifyReceipt(@Body() qrData: VerifyReceiptDto, @Request() req: any) {
    const customerId = req.user?.id;
    return this.fnsService.verifyReceipt(qrData, customerId);
  }

  @Get('status/:requestId')
  @ApiOperation({ summary: 'Get receipt verification status' })
  @ApiResponse({ status: 200, description: 'Request status', type: ReceiptStatusDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async getStatus(@Param('requestId') requestId: string) {
    return this.fnsService.getRequestStatus(requestId);
  }

  @Get('stats/queue')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue statistics' })
  async getQueueStats() {
    return this.fnsService.getQueueStats();
  }

  @Get('stats/daily-count')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get daily request count' })
  @ApiResponse({ status: 200, description: 'Daily request count' })
  async getDailyRequestCount() {
    const count = await this.fnsService.getDailyRequestCount();
    return { count, limit: 1000 };
  }

  @Get('history/cashback')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get customer cashback history' })
  @ApiResponse({ status: 200, description: 'Cashback history' })
  async getCashbackHistory(@Request() req: any) {
    const customerId = req.user.id;
    return this.fnsService.getCustomerCashbackHistory(customerId);
  }
} 