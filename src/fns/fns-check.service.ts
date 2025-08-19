import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FnsCheckService {
  private readonly logger = new Logger(FnsCheckService.name);

  private normalizeSum(sum: any, additionalData?: Record<string, any>): number {
    const numericSum = typeof sum === 'string' ? parseInt(sum, 10) : Number(sum);
    if (!Number.isFinite(numericSum)) return 0;

    // Если явно указано, что сумма уже в копейках, возвращаем как есть
    if (additionalData && (additionalData.sumInKopecks === true || additionalData.sum_unit === 'kopecks')) {
      return Math.trunc(numericSum);
    }

    // По умолчанию считаем, что если сумма меньше 1000, то она в рублях — конвертируем в копейки
    // Это помогает, если клиент прислал 120 вместо 12000
    if (numericSum > 0 && numericSum < 1000) {
      return Math.trunc(numericSum * 100);
    }

    return Math.trunc(numericSum);
  }

  private normalizeDate(dateInput: any): string {
    if (!dateInput) return '';
    const str = String(dateInput).trim();

    // Если приходит уже ISO с временем
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      return str.length === 16 ? str + ':00' : str;
    }

    // Формат YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str + 'T00:00:00';
    }

    // Формат DD.MM.YYYY[ HH:mm[:ss]]
    const dm = str.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (dm) {
      const [, d, m, y, hh = '00', mm = '00', ss = '00'] = dm;
      return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
    }

    // Формат YYYYMMDDTHHmm (классический из QR)
    const compact = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/);
    if (compact) {
      const [, y, m, d, hh, mm, ss = '00'] = compact;
      return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
    }

    // Fallback — пробуем через Date
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const y = date.getFullYear();
      const m = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      const hh = pad(date.getHours());
      const mm = pad(date.getMinutes());
      const ss = pad(date.getSeconds());
      return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
    }

    return str; // как есть, чтобы не ломать, если формат уже пригоден для ФНС
  }

  async sendCheckRequest(qrData: any, token: string): Promise<string> {
    this.logger.log(`Sending check request for QR data: ${JSON.stringify(qrData)}`);

    try {
      const messageId = await this.makeSendMessageRequest(qrData, token);
      
      this.logger.log(`Received message ID: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error('Error sending check request:', error);
      throw new Error('Failed to send check request to FNS');
    }
  }

  async getCheckResult(messageId: string, token: string): Promise<any> {
    this.logger.log(`Getting check result for message ID: ${messageId}`);

    try {
      const result = await this.makeGetMessageRequest(messageId, token);
      
      this.logger.log(`Received check result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error('Error getting check result:', error);
      throw new Error('Failed to get check result from FNS');
    }
  }

  private async makeSendMessageRequest(qrData: any, token: string): Promise<string> {
    const baseUrl = process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090';
    const serviceUrl = `${baseUrl}/open-api/ais3/KktService/0.1`;
    
    const sum = this.normalizeSum(qrData.sum, qrData.additionalData);
    const date = this.normalizeDate(qrData.date || qrData.dateTime);
    const typeOperation = qrData.typeOperation || 1;
    
    const soapRequest = `
      <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
        <soap-env:Body>
          <ns0:SendMessageRequest xmlns:ns0="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
            <ns0:Message>
              <tns:GetTicketRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0">
                <tns:GetTicketInfo>
                  <tns:Sum>${sum}</tns:Sum>
                  <tns:Date>${date}</tns:Date>
                  <tns:Fn>${qrData.fn}</tns:Fn>
                  <tns:TypeOperation>${typeOperation}</tns:TypeOperation>
                  <tns:FiscalDocumentId>${qrData.fd}</tns:FiscalDocumentId>
                  <tns:FiscalSign>${qrData.fp}</tns:FiscalSign>
                  <tns:RawData>true</tns:RawData>
                </tns:GetTicketInfo>
              </tns:GetTicketRequest>
            </ns0:Message>
          </ns0:SendMessageRequest>
        </soap-env:Body>
      </soap-env:Envelope>
    `;

    try {
      this.logger.log(`Sending SOAP request to: ${serviceUrl}`);
      
      const response = await axios.post(serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });

      const messageId = this.parseSendMessageResponse(response.data);
      this.logger.log(`Successfully sent message, received ID: ${messageId}`);
      return messageId;
    } catch (error) {
      if (error.response?.status === 429) {
        this.logger.error('Rate limiting error from FNS');
        throw new Error('Rate limiting error from FNS');
      }
      
      if (error.response?.data?.includes('Доступ к сервису для переданного IP, запрещен')) {
        this.logger.error('IP address not whitelisted for FNS KktService');
        throw new Error('IP address not whitelisted for FNS KktService');
      }
      
      if (error.response?.data?.includes('Доступ к сервису для token запрещен')) {
        this.logger.error('Invalid or expired FNS token');
        throw new Error('Authentication failed - invalid token');
      }
      
      this.logger.error('SOAP SendMessage request failed:', error.response?.data || error.message);
      throw new Error('Failed to send message to FNS');
    }
  }

  private async makeGetMessageRequest(messageId: string, token: string): Promise<any> {
    const baseUrl = process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090';
    const serviceUrl = `${baseUrl}/open-api/ais3/KktService/0.1`;

    const soapRequest = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
        <soapenv:Header/>
        <soapenv:Body>
          <ns:GetMessageRequest>
            <ns:MessageId>${messageId}</ns:MessageId>
          </ns:GetMessageRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    try {
      const response = await axios.post(serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:GetMessageRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });

      const result = this.parseGetMessageResponse(response.data);
      return result;
    } catch (error) {
      if (error.response?.status === 429) {
        this.logger.error('Rate limiting error from FNS');
        throw new Error('Rate limiting error from FNS');
      }
      
      if (error.response?.data?.includes('MessageNotFoundFault') || 
          error.response?.data?.includes('По переданному MessageId') ||
          error.response?.data?.includes('сообщение не найдено')) {
        this.logger.error('Message not found in FNS');
        throw new Error('Message not found in FNS');
      }
      
      if (error.response?.data?.includes('Доступ к сервису для переданного IP, запрещен')) {
        this.logger.error('IP address not whitelisted for FNS KktService');
        throw new Error('IP address not whitelisted for FNS KktService');
      }
      
      if (error.response?.data?.includes('Доступ к сервису для token запрещен')) {
        this.logger.error('Invalid or expired FNS token');
        throw new Error('Authentication failed - invalid token');
      }
      
      this.logger.error('SOAP GetMessage request failed:', error.response?.data || error.message);
      throw new Error('Failed to get message from FNS');
    }
  }

  private parseSendMessageResponse(xmlResponse: string): string {
    const messageIdMatch = xmlResponse.match(/<MessageId>([^<]+)<\/MessageId>/);
    if (messageIdMatch) {
      return messageIdMatch[1];
    }

    throw new Error('Failed to parse MessageId from FNS response');
  }

  private parseGetMessageResponse(xmlResponse: string): any {
    const processingStatusMatch = xmlResponse.match(/<ProcessingStatus>([^<]+)<\/ProcessingStatus>/);
    const fnsProcessingStatus = processingStatusMatch ? processingStatusMatch[1] : 'UNKNOWN';

    // Читаем код результата, если есть
    const codeMatch = xmlResponse.match(/<(?:\w+:)?Code>(\d+)<\/(?:\w+:)?Code>/);
    const resultCode = codeMatch ? parseInt(codeMatch[1], 10) : undefined;

    // Ищем Ticket без привязки к namespace
    const ticketMatch = xmlResponse.match(/<(?:\w+:)?Ticket>([\s\S]*?)<\/(?:\w+:)?Ticket>/);
    let receiptData = null;
    if (ticketMatch && ticketMatch[1]) {
      try {
        receiptData = JSON.parse(ticketMatch[1].trim());
      } catch (e) {
        this.logger.warn('Failed to parse ticket JSON:', e);
      }
    }

    let status: 'pending' | 'processing' | 'success' | 'rejected' | 'failed';
    let isValid = false;
    let isReturn = false;
    let isFake = false;

    switch (fnsProcessingStatus) {
      case 'PENDING':
        status = 'pending';
        break;
      case 'PROCESSING':
        status = 'processing';
        break;
      case 'COMPLETED':
        if (receiptData) {
          // Проверяем тип операции в полученных данных чека
          const operationType = receiptData.operationType || receiptData.operation;
          
          // Проверяем различные индикаторы возврата в данных ФНС
          const isReturnByType = operationType === 2 || operationType === '2' || 
                                operationType === 'return' || operationType === 'возврат';
          const isReturnByName = receiptData.operationName && 
                                (receiptData.operationName.toLowerCase().includes('возврат') ||
                                 receiptData.operationName.toLowerCase().includes('return'));
          const isReturnByItems = receiptData.items && receiptData.items.some((item: any) => 
                                  item.price < 0 || item.sum < 0);
          
          isReturn = isReturnByType || isReturnByName || isReturnByItems;
          
          if (isReturn) {
            status = 'rejected';
            this.logger.warn(`Receipt rejected - return operation detected. Type: ${operationType}, Operation: ${receiptData.operationName}`);
          } else {
            status = 'success';
            isValid = true;
            this.logger.log(`Receipt validated successfully - normal purchase operation`);
          }
        } else {
          // Если нет Ticket, но есть код — ориентируемся по нему
          if (typeof resultCode === 'number' && resultCode !== 200) {
            status = 'rejected';
            isFake = false;
            this.logger.warn(`Receipt rejected by FNS. Result code: ${resultCode}`);
          } else {
            // Не удалось распарсить Ticket — не считаем чек фальшивым, просто отклоняем
            status = 'rejected';
            isFake = false;
            this.logger.warn('Receipt rejected - no ticket data parsed from FNS response');
          }
        }
        break;
      case 'FAILED':
        status = 'failed';
        isFake = true;
        this.logger.warn('Receipt failed - FNS processing failed');
        break;
      default:
        status = 'failed';
        isFake = true;
        this.logger.warn(`Receipt failed - unknown FNS processing status: ${fnsProcessingStatus}`);
    }

    return {
      processingStatus: fnsProcessingStatus,
      status,
      isValid,
      isReturn,
      isFake,
      receiptData,
    };
  }

  async waitForResult(messageId: string, token: string, maxAttempts: number = 10): Promise<any> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const result = await this.getCheckResult(messageId, token);
        
        if (result.status === 'success' || result.status === 'rejected' || result.status === 'failed') {
          return result;
        }
        
        if (result.status === 'processing') {
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
          continue;
        }
        
        if (result.status === 'pending') {
          await new Promise(resolve => setTimeout(resolve, 3000));
          attempts++;
          continue;
        }
        
        throw new Error(`Unexpected status: ${result.status}`);
        
      } catch (error) {
        if (error.message.includes('Rate limiting')) {
          await new Promise(resolve => setTimeout(resolve, 10000));
        } else if (error.message.includes('Message not found')) {
          throw error;
        } else {
          this.logger.error(`Error in attempt ${attempts + 1}:`, error);
          attempts++;
        }
        
        if (attempts >= maxAttempts) {
          throw new Error('Max attempts reached while waiting for FNS result');
        }
      }
    }
    
    throw new Error('Timeout waiting for FNS result');
  }


} 