import { Controller, Post, Get, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FnsService } from './fns.service';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { ReceiptStatusDto } from './dto/receipt-status.dto';
import { ParseQrDto, QrParseResultDto } from './dto/parse-qr.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Public } from '../decorators/public.decorator';

@ApiTags('FNS Receipt Verification')
@Controller('receipt')
export class FnsController {
  constructor(private readonly fnsService: FnsService) {}

  @Post('verify')
  @ApiOperation({ summary: 'Verify receipt using QR code data (with authentication for cashback)' })
  @ApiResponse({ status: 200, description: 'Receipt verification started' })
  @ApiResponse({ status: 400, description: 'Invalid QR data' })
  @ApiResponse({ status: 429, description: 'Daily limit exceeded' })
  async verifyReceipt(@Body() qrData: VerifyReceiptDto, @Request() req: any) {
    const customerId = req.user?.id;
    return this.fnsService.verifyReceipt(qrData, customerId);
  }

  @Post('verify/test')
  @Public()
  @ApiOperation({ summary: 'Test receipt verification without authentication (no cashback)' })
  @ApiResponse({ status: 200, description: 'Receipt verification started' })
  @ApiResponse({ status: 400, description: 'Invalid QR data' })
  @ApiResponse({ status: 429, description: 'Daily limit exceeded' })
  async testVerifyReceipt(@Body() qrData: VerifyReceiptDto) {
    return this.fnsService.verifyReceipt(qrData);
  }

  @Post('parse-qr')
  @Public()
  @ApiOperation({ summary: 'Parse QR code data from receipt' })
  @ApiResponse({ status: 200, description: 'QR code parsed successfully', type: QrParseResultDto })
  @ApiResponse({ status: 400, description: 'Invalid QR data' })
  async parseQrCode(@Body() parseQrDto: ParseQrDto): Promise<QrParseResultDto> {
    return this.fnsService.parseQrCode(parseQrDto.qrData);
  }

  @Get('status/:requestId')
  @Public()
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