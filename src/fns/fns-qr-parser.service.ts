import { Injectable, Logger, BadRequestException } from '@nestjs/common';

@Injectable()
export class FnsQrParserService {
  private readonly logger = new Logger(FnsQrParserService.name);

  parseQrCode(qrCode: string): {
    fn: string;
    fd: string;
    fp: string;
    sum: string;
    date: string;
    typeOperation?: string;
  } {
    this.logger.log(`Parsing QR code: ${qrCode}`);

    try {
      // Парсим QR-код в формате ФНС
      const params = new URLSearchParams(qrCode);
      
      const fn = params.get('fn');
      const i = params.get('i'); // FiscalDocumentId
      const fp = params.get('fp'); // FiscalSign
      const s = params.get('s'); // Sum
      const t = params.get('t'); // Date
      const n = params.get('n'); // TypeOperation

      if (!fn || !i || !fp || !s || !t) {
        throw new BadRequestException('Неверный формат QR-кода. Отсутствуют обязательные параметры.');
      }

      // Преобразуем дату из формата ФНС в ISO
      const date = this.parseFnsDate(t);

      return {
        fn,
        fd: i,
        fp,
        sum: s,
        date,
        typeOperation: n || '1',
      };
    } catch (error) {
      this.logger.error('Error parsing QR code:', error);
      throw new BadRequestException('Неверный формат QR-кода');
    }
  }

  private parseFnsDate(dateStr: string): string {
    // Формат даты ФНС: YYYYMMDDTHHMM
    // Пример: 20231201T1430
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(9, 11);
    const minute = dateStr.substring(11, 13);
    
    return `${year}-${month}-${day}T${hour}:${minute}:00`;
  }

  validateQrCode(qrCode: string): boolean {
    try {
      const params = new URLSearchParams(qrCode);
      const requiredParams = ['fn', 'i', 'fp', 's', 't'];
      
      return requiredParams.every(param => params.has(param));
    } catch {
      return false;
    }
  }
}