import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FnsCheckService {
  private readonly logger = new Logger(FnsCheckService.name);

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
    
    // Валидация и форматирование данных для ФНС
    const formattedData = this.formatQrDataForFns(qrData);
    this.logger.log(`Formatted data for FNS: ${JSON.stringify(formattedData)}`);
    
    const soapRequest = `
      <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
        <soap-env:Body>
          <ns0:SendMessageRequest xmlns:ns0="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
            <ns0:Message>
              <tns:GetTicketRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0">
                <tns:GetTicketInfo>
                  <tns:Sum>${formattedData.sum}</tns:Sum>
                  <tns:Date>${formattedData.date}</tns:Date>
                  <tns:Fn>${formattedData.fn}</tns:Fn>
                  <tns:TypeOperation>${formattedData.typeOperation}</tns:TypeOperation>
                  <tns:FiscalDocumentId>${formattedData.fd}</tns:FiscalDocumentId>
                  <tns:FiscalSign>${formattedData.fp}</tns:FiscalSign>
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
      this.logger.log(`SOAP request body: ${soapRequest}`);
      
      const response = await axios.post(serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
          'FNS-OpenApi-Token': token,
        },
        timeout: 30000,
      });

      this.logger.log(`FNS response status: ${response.status}`);
      this.logger.log(`FNS response data: ${response.data}`);

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
      
      // Добавляем более детальное логирование ошибок
      this.logger.error('SOAP SendMessage request failed:');
      this.logger.error(`Status: ${error.response?.status}`);
      this.logger.error(`Data: ${error.response?.data}`);
      this.logger.error(`Headers: ${JSON.stringify(error.response?.headers)}`);
      this.logger.error(`Message: ${error.message}`);
      
      throw new Error(`Failed to send message to FNS: ${error.response?.data || error.message}`);
    }
  }

  /**
   * Форматирует данные QR кода для отправки в ФНС
   */
  private formatQrDataForFns(qrData: any) {
    // Валидация обязательных полей
    if (!qrData.fn || !qrData.fd || !qrData.fp || !qrData.sum || !qrData.date) {
      throw new Error('Missing required QR data fields: fn, fd, fp, sum, date');
    }

    // Форматирование суммы (должна быть в копейках)
    let sum = qrData.sum;
    if (typeof sum === 'string') {
      sum = parseInt(sum, 10);
    }
    if (isNaN(sum) || sum <= 0) {
      throw new Error(`Invalid sum value: ${qrData.sum}`);
    }

    // Форматирование даты для ФНС (ISO формат)
    let formattedDate = qrData.date;
    try {
      const date = new Date(qrData.date);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${qrData.date}`);
      }
      
      // Проверяем, что дата не в будущем (более чем на 1 день)
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (date > oneDayFromNow) {
        this.logger.warn(`Receipt date is in the future: ${qrData.date}. This may cause FNS rejection.`);
      }
      
      // ФНС ожидает формат: YYYY-MM-DDTHH:mm:ss без миллисекунд и таймзоны
      formattedDate = date.toISOString().split('.')[0];
    } catch (error) {
      throw new Error(`Failed to format date: ${qrData.date}`);
    }

    // Валидация типа операции
    const typeOperation = qrData.typeOperation || 1;
    if (typeOperation !== 1 && typeOperation !== 2) {
      this.logger.warn(`Unusual typeOperation: ${typeOperation}. Expected 1 (purchase) or 2 (return).`);
    }

    // Валидация фискальных данных
    const fn = String(qrData.fn).trim();
    const fd = String(qrData.fd).trim();
    const fp = String(qrData.fp).trim();

    if (fn.length !== 16) {
      this.logger.warn(`FN length is not 16 characters: ${fn} (length: ${fn.length})`);
    }

    if (!/^\d+$/.test(fn)) {
      this.logger.warn(`FN contains non-numeric characters: ${fn}`);
    }

    if (!/^\d+$/.test(fd)) {
      this.logger.warn(`FD contains non-numeric characters: ${fd}`);
    }

    if (!/^\d+$/.test(fp)) {
      this.logger.warn(`FP contains non-numeric characters: ${fp}`);
    }

    return {
      fn,
      fd,
      fp,
      sum,
      date: formattedDate,
      typeOperation,
    };
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
    this.logger.log(`Parsing FNS response: ${xmlResponse}`);
    
    const processingStatusMatch = xmlResponse.match(/<ProcessingStatus>([^<]+)<\/ProcessingStatus>/);
    const fnsProcessingStatus = processingStatusMatch ? processingStatusMatch[1] : 'UNKNOWN';
    
    this.logger.log(`FNS ProcessingStatus: ${fnsProcessingStatus}`);

    // Поиск данных чека в различных возможных форматах
    const ticketMatch = xmlResponse.match(/<ns2:Ticket>([^<]+)<\/ns2:Ticket>/) ||
                       xmlResponse.match(/<Ticket>([^<]+)<\/Ticket>/) ||
                       xmlResponse.match(/<ticket>([^<]+)<\/ticket>/);
    
    let receiptData = null;
    
    if (ticketMatch) {
      this.logger.log(`Found ticket data: ${ticketMatch[1]}`);
      try {
        receiptData = JSON.parse(ticketMatch[1]);
        this.logger.log(`Parsed receipt data: ${JSON.stringify(receiptData)}`);
      } catch (e) {
        this.logger.error('Failed to parse ticket JSON:', e);
        this.logger.error('Raw ticket data:', ticketMatch[1]);
      }
    } else {
      this.logger.warn('No ticket data found in FNS response');
      
      // Проверяем наличие ошибок в ответе
      const errorMatch = xmlResponse.match(/<Error>([^<]+)<\/Error>/) ||
                        xmlResponse.match(/<error>([^<]+)<\/error>/) ||
                        xmlResponse.match(/<faultstring>([^<]+)<\/faultstring>/);
      
      if (errorMatch) {
        this.logger.error(`FNS returned error: ${errorMatch[1]}`);
      }
    }

    let status: 'pending' | 'processing' | 'success' | 'rejected' | 'failed';
    let isValid = false;
    let isReturn = false;
    let isFake = false;

    switch (fnsProcessingStatus) {
      case 'PENDING':
        status = 'pending';
        this.logger.log('Receipt is still pending processing by FNS');
        break;
      case 'PROCESSING':
        status = 'processing';
        this.logger.log('Receipt is being processed by FNS');
        break;
      case 'COMPLETED':
        this.logger.log('FNS completed processing');
        if (receiptData) {
          // Проверяем тип операции в полученных данных чека
          const operationType = receiptData.operationType || receiptData.operation || receiptData.type;
          this.logger.log(`Receipt operation type: ${operationType}`);
          
          // Проверяем различные индикаторы возврата в данных ФНС
          const isReturnByType = operationType === 2 || operationType === '2' || 
                                operationType === 'return' || operationType === 'возврат';
          const isReturnByName = receiptData.operationName && 
                                (receiptData.operationName.toLowerCase().includes('возврат') ||
                                 receiptData.operationName.toLowerCase().includes('return'));
          const isReturnByItems = receiptData.items && receiptData.items.some((item: any) => 
                                  item.price < 0 || item.sum < 0);
          
          isReturn = isReturnByType || isReturnByName || isReturnByItems;
          
          this.logger.log(`Return check - byType: ${isReturnByType}, byName: ${isReturnByName}, byItems: ${isReturnByItems}`);
          
          if (isReturn) {
            status = 'rejected';
            this.logger.warn(`Receipt rejected - return operation detected. Type: ${operationType}, Operation: ${receiptData.operationName}`);
          } else {
            status = 'success';
            isValid = true;
            this.logger.log(`Receipt validated successfully - normal purchase operation`);
          }
        } else {
          status = 'rejected';
          isFake = true;
          this.logger.warn('Receipt rejected - no receipt data received from FNS (possible fake receipt)');
        }
        break;
      case 'FAILED':
        status = 'failed';
        isFake = true;
        this.logger.warn('Receipt failed - FNS processing failed (possible network/server error)');
        break;
      case 'UNKNOWN':
      default:
        status = 'failed';
        isFake = true;
        this.logger.error(`Receipt failed - unknown FNS processing status: ${fnsProcessingStatus}`);
        this.logger.error('Full FNS response for debugging:', xmlResponse);
    }

    const result = {
      processingStatus: fnsProcessingStatus,
      status,
      isValid,
      isReturn,
      isFake,
      receiptData,
    };
    
    this.logger.log(`Final parsed result: ${JSON.stringify(result)}`);
    return result;
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