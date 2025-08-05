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
    const serviceUrl = process.env.FNS_ASYNC_SERVICE_URL || 'https://openapi.nalog.ru:8090/open-api/ais3/KktService/0.1';
    const appId = process.env.FNS_APP_ID;

    const soapRequest = `
      <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
        <soap-env:Body>
          <ns0:SendMessageRequest xmlns:ns0="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
            <ns0:Message>
              <tns:GetTicketRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0">
                <tns:GetTicketInfo>
                  <tns:Sum>${qrData.sum}</tns:Sum>
                  <tns:Date>${qrData.date}</tns:Date>
                  <tns:Fn>${qrData.fn}</tns:Fn>
                  <tns:TypeOperation>1</tns:TypeOperation>
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
      const response = await axios.post(serviceUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:SendMessageRequest',
          'FNS-OpenApi-Token': token,
          'FNS-OpenApi-UserToken': appId,
        },
        timeout: 30000,
      });

      const messageId = this.parseSendMessageResponse(response.data);
      return messageId;
    } catch (error) {
      if (error.response?.status === 429) {
        this.logger.error('Rate limiting error from FNS');
        throw new Error('Rate limiting error from FNS');
      }
      
      this.logger.error('SOAP SendMessage request failed:', error.response?.data || error.message);
      throw new Error('Failed to send message to FNS');
    }
  }

  private async makeGetMessageRequest(messageId: string, token: string): Promise<any> {
    const serviceUrl = process.env.FNS_ASYNC_SERVICE_URL || 'https://openapi.nalog.ru:8090/open-api/ais3/KktService/0.1';
    const appId = process.env.FNS_APP_ID;

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
          'FNS-OpenApi-UserToken': appId,
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
      
      if (error.response?.data?.includes('MessageNotFoundFault')) {
        this.logger.error('Message not found in FNS');
        throw new Error('Message not found in FNS');
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

    const ticketMatch = xmlResponse.match(/<ns2:Ticket>([^<]+)<\/ns2:Ticket>/);
    let receiptData = null;
    
    if (ticketMatch) {
      try {
        receiptData = JSON.parse(ticketMatch[1]);
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
          status = 'success';
          isValid = true;
        } else {
          status = 'rejected';
          isFake = true;
        }
        break;
      case 'FAILED':
        status = 'failed';
        isFake = true;
        break;
      default:
        status = 'failed';
        isFake = true;
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