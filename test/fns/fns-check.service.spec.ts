import { Test, TestingModule } from '@nestjs/testing';
import { FnsCheckService } from '../../src/fns/fns-check.service';
import { Logger } from '@nestjs/common';
import axios from 'axios';

// Мокируем axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FnsCheckService', () => {
  let service: FnsCheckService;

  const mockQrData = {
    fn: '9287440300090728',
    fd: '77133',
    fp: '1482926127',
    sum: 240000,
    date: '2019-04-09T16:38:00',
    typeOperation: 1
  };

  const mockToken = 'test-token-12345';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FnsCheckService],
    }).compile();

    service = module.get<FnsCheckService>(FnsCheckService);

    // Подавляем логи в тестах
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Сбрасываем переменную окружения для тестов
    process.env.NODE_ENV = 'test';
    process.env.FNS_DEV_MODE = 'false';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendCheckRequest', () => {
    it('should send check request successfully', async () => {
      const mockResponse = {
        data: '<soap:Envelope><soap:Body><SendMessageResponse><MessageId>test-message-id-123</MessageId></SendMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.sendCheckRequest(mockQrData, mockToken);

      expect(result).toBe('test-message-id-123');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/open-api/ais3/KktService/0.1'),
        expect.stringContaining('<tns:GetTicketRequest'),
        expect.objectContaining({
          headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': 'urn:SendMessageRequest',
            'FNS-OpenApi-Token': mockToken,
          },
          timeout: 30000,
        })
      );
    });

    it('should handle rate limiting (429) errors', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: '<soap:Envelope><soap:Body><soap:Fault><faultstring>Rate limit exceeded</faultstring></soap:Fault></soap:Body></soap:Envelope>',
        },
      };

      mockedAxios.post.mockRejectedValue(rateLimitError);

      await expect(service.sendCheckRequest(mockQrData, mockToken)).rejects.toThrow(
        'Rate limiting error from FNS'
      );
    });

    it('should handle IP blocking errors', async () => {
      const ipBlockError = {
        response: {
          data: '<soap:Envelope><soap:Body><soap:Fault><faultstring>Доступ к сервису для переданного IP, запрещен</faultstring></soap:Fault></soap:Body></soap:Envelope>',
        },
      };

      mockedAxios.post.mockRejectedValue(ipBlockError);

      await expect(service.sendCheckRequest(mockQrData, mockToken)).rejects.toThrow(
        'IP address not whitelisted'
      );
    });

    it('should handle authentication errors', async () => {
      const authError = {
        response: {
          data: '<soap:Envelope><soap:Body><soap:Fault><faultstring>Доступ к сервису для token запрещен</faultstring></soap:Fault></soap:Body></soap:Envelope>',
        },
      };

      mockedAxios.post.mockRejectedValue(authError);

      await expect(service.sendCheckRequest(mockQrData, mockToken)).rejects.toThrow(
        'Authentication failed'
      );
    });

    it('should handle invalid response format', async () => {
      const invalidResponse = {
        data: '<invalid>response</invalid>',
      };

      mockedAxios.post.mockResolvedValue(invalidResponse);

      await expect(service.sendCheckRequest(mockQrData, mockToken)).rejects.toThrow(
        'Failed to send check request to FNS'
      );
    });

    it('should return mock message ID in development mode', async () => {
      process.env.NODE_ENV = 'development';
      process.env.FNS_DEV_MODE = 'true';

      const result = await service.sendCheckRequest(mockQrData, mockToken);

      expect(result).toMatch(/mock_message_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('getCheckResult', () => {
    const mockMessageId = 'test-message-id-123';

    it('should get check result successfully for processing status', async () => {
      const mockResponse = {
        data: '<soap:Envelope><soap:Body><GetMessageResponse><ProcessingStatus>PROCESSING</ProcessingStatus></GetMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.getCheckResult(mockMessageId, mockToken);

      expect(result).toEqual({
        status: 'processing',
        processingStatus: 'PROCESSING',
      });
    });

    it('should get check result successfully for completed status', async () => {
      const mockResponse = {
        data: `<soap:Envelope><soap:Body><GetMessageResponse>
          <ProcessingStatus>COMPLETED</ProcessingStatus>
          <Message>
            <GetTicketResponse>
              <ns2:Result>
                <ns2:Code>200</ns2:Code>
                <ns2:Ticket>{"fiscalDocumentNumber": 77133, "totalSum": 240000}</ns2:Ticket>
              </ns2:Result>
            </GetTicketResponse>
          </Message>
        </GetMessageResponse></soap:Body></soap:Envelope>`,
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.getCheckResult(mockMessageId, mockToken);

      expect(result.status).toBe('success');
      expect(result.processingStatus).toBe('COMPLETED');
      expect(result.receiptData).toBeDefined();
    });

    it('should handle message not found error', async () => {
      const notFoundError = {
        response: {
          data: '<soap:Envelope><soap:Body><soap:Fault><faultstring>По переданному MessageId сообщение не найдено</faultstring></soap:Fault></soap:Body></soap:Envelope>',
        },
      };

      mockedAxios.post.mockRejectedValue(notFoundError);

      await expect(service.getCheckResult(mockMessageId, mockToken)).rejects.toThrow(
        'Message not found'
      );
    });

    it('should return mock result in development mode', async () => {
      process.env.NODE_ENV = 'development';
      process.env.FNS_DEV_MODE = 'true';

      const result = await service.getCheckResult(mockMessageId, mockToken);

      expect(result.status).toBe('success');
      expect(result.receiptData).toBeDefined();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('waitForResult', () => {
    const mockMessageId = 'test-message-id-123';

    it('should wait for result and return when completed', async () => {
      // Первый вызов - PROCESSING
      const processingResponse = {
        data: '<soap:Envelope><soap:Body><GetMessageResponse><ProcessingStatus>PROCESSING</ProcessingStatus></GetMessageResponse></soap:Body></soap:Envelope>',
      };

      // Второй вызов - COMPLETED
      const completedResponse = {
        data: `<soap:Envelope><soap:Body><GetMessageResponse>
          <ProcessingStatus>COMPLETED</ProcessingStatus>
          <Message>
            <GetTicketResponse>
              <ns2:Result>
                <ns2:Code>200</ns2:Code>
                <ns2:Ticket>{"fiscalDocumentNumber": 77133}</ns2:Ticket>
              </ns2:Result>
            </GetTicketResponse>
          </Message>
        </GetMessageResponse></soap:Body></soap:Envelope>`,
      };

      mockedAxios.post
        .mockResolvedValueOnce(processingResponse)
        .mockResolvedValueOnce(completedResponse);

      // Мокируем setTimeout для ускорения тестов
      jest.useFakeTimers();
      
      const resultPromise = service.waitForResult(mockMessageId, mockToken, 2);
      
      // Ускоряем время
      jest.advanceTimersByTime(5000);
      
      const result = await resultPromise;

      expect(result.status).toBe('success');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should timeout after maxAttempts', async () => {
      const processingResponse = {
        data: '<soap:Envelope><soap:Body><GetMessageResponse><ProcessingStatus>PROCESSING</ProcessingStatus></GetMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(processingResponse);

      jest.useFakeTimers();

      const resultPromise = service.waitForResult(mockMessageId, mockToken, 2);
      
      // Ускоряем время до превышения лимита попыток
      jest.advanceTimersByTime(15000);

      await expect(resultPromise).rejects.toThrow('Timeout waiting for FNS response');

      jest.useRealTimers();
    });
  });

  describe('SOAP request validation', () => {
    it('should generate correct SOAP structure for sendCheckRequest', async () => {
      const mockResponse = {
        data: '<soap:Envelope><soap:Body><SendMessageResponse><MessageId>test-id</MessageId></SendMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await service.sendCheckRequest(mockQrData, mockToken);

      const soapRequest = mockedAxios.post.mock.calls[0][1];

      // Проверяем структуру SOAP запроса
      expect(soapRequest).toContain('<soap-env:Envelope');
      expect(soapRequest).toContain('<ns0:SendMessageRequest');
      expect(soapRequest).toContain('<tns:GetTicketRequest');
      expect(soapRequest).toContain('<tns:GetTicketInfo>');
      expect(soapRequest).toContain(`<tns:Sum>${mockQrData.sum}</tns:Sum>`);
      expect(soapRequest).toContain(`<tns:Date>${mockQrData.date}</tns:Date>`);
      expect(soapRequest).toContain(`<tns:Fn>${mockQrData.fn}</tns:Fn>`);
      expect(soapRequest).toContain(`<tns:FiscalDocumentId>${mockQrData.fd}</tns:FiscalDocumentId>`);
      expect(soapRequest).toContain(`<tns:FiscalSign>${mockQrData.fp}</tns:FiscalSign>`);
      expect(soapRequest).toContain('<tns:RawData>true</tns:RawData>');
    });

    it('should use correct namespaces and action headers', async () => {
      const mockResponse = {
        data: '<soap:Envelope><soap:Body><SendMessageResponse><MessageId>test-id</MessageId></SendMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await service.sendCheckRequest(mockQrData, mockToken);

      const soapRequest = mockedAxios.post.mock.calls[0][1];
      const headers = mockedAxios.post.mock.calls[0][2].headers;

      expect(soapRequest).toContain('urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0');
      expect(soapRequest).toContain('urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0');
      expect(headers['SOAPAction']).toBe('urn:SendMessageRequest');
      expect(headers['FNS-OpenApi-Token']).toBe(mockToken);
    });
  });

  describe('response parsing', () => {
    it('should parse SendMessageResponse correctly', () => {
      const xmlResponse = '<soap:Envelope><soap:Body><SendMessageResponse xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0"><MessageId>parsed-message-id</MessageId></SendMessageResponse></soap:Body></soap:Envelope>';

      const result = (service as any).parseSendMessageResponse(xmlResponse);

      expect(result).toBe('parsed-message-id');
    });

    it('should parse GetMessageResponse for processing status', () => {
      const xmlResponse = '<soap:Envelope><soap:Body><GetMessageResponse><ProcessingStatus>PROCESSING</ProcessingStatus></GetMessageResponse></soap:Body></soap:Envelope>';

      const result = (service as any).parseGetMessageResponse(xmlResponse);

      expect(result).toEqual({
        status: 'processing',
        processingStatus: 'PROCESSING',
      });
    });

    it('should parse GetMessageResponse for completed status with receipt data', () => {
      const xmlResponse = `<soap:Envelope><soap:Body><GetMessageResponse>
        <ProcessingStatus>COMPLETED</ProcessingStatus>
        <Message>
          <GetTicketResponse>
            <ns2:Result>
              <ns2:Code>200</ns2:Code>
              <ns2:Ticket>{"fiscalDocumentNumber": 77133, "totalSum": 240000, "dateTime": "2019-04-09T16:38:00"}</ns2:Ticket>
            </ns2:Result>
          </GetTicketResponse>
        </Message>
      </GetMessageResponse></soap:Body></soap:Envelope>`;

      const result = (service as any).parseGetMessageResponse(xmlResponse);

      expect(result.status).toBe('success');
      expect(result.processingStatus).toBe('COMPLETED');
      expect(result.receiptData).toEqual({
        fiscalDocumentNumber: 77133,
        totalSum: 240000,
        dateTime: '2019-04-09T16:38:00',
      });
    });

    it('should parse failed check result', () => {
      const xmlResponse = `<soap:Envelope><soap:Body><GetMessageResponse>
        <ProcessingStatus>COMPLETED</ProcessingStatus>
        <Message>
          <GetTicketResponse>
            <ns2:Result>
              <ns2:Code>400</ns2:Code>
              <ns2:Message>Чек не найден</ns2:Message>
            </ns2:Result>
          </GetTicketResponse>
        </Message>
      </GetMessageResponse></soap:Body></soap:Envelope>`;

      const result = (service as any).parseGetMessageResponse(xmlResponse);

      expect(result.status).toBe('failed');
      expect(result.processingStatus).toBe('COMPLETED');
      expect(result.errorMessage).toBe('Чек не найден');
    });

    it('should throw error if cannot parse MessageId', () => {
      const invalidXml = '<soap:Envelope><soap:Body><Error>No MessageId</Error></soap:Body></soap:Envelope>';

      expect(() => {
        (service as any).parseSendMessageResponse(invalidXml);
      }).toThrow('Failed to parse MessageId from FNS response');
    });
  });

  describe('error handling', () => {
    it('should handle various FNS error messages', async () => {
      const errorCases = [
        {
          errorMessage: 'Превышен общий дневной лимит запросов',
          expectedError: 'Daily request limit exceeded',
        },
        {
          errorMessage: 'Превышен лимит запросов метода',
          expectedError: 'Method request limit exceeded',
        },
        {
          errorMessage: 'Не удалось обнаружить требуемые заголовки',
          expectedError: 'Required headers missing',
        },
        {
          errorMessage: 'Значение ЭЦП не прошло проверку',
          expectedError: 'Digital signature verification failed',
        },
      ];

      for (const errorCase of errorCases) {
        const errorResponse = {
          response: {
            data: `<soap:Envelope><soap:Body><soap:Fault><faultstring>${errorCase.errorMessage}</faultstring></soap:Fault></soap:Body></soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(errorResponse);

        await expect(service.sendCheckRequest(mockQrData, mockToken)).rejects.toThrow(
          errorCase.expectedError
        );

        jest.clearAllMocks();
      }
    });

    it('should handle network timeouts', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      };

      mockedAxios.post.mockRejectedValue(timeoutError);

      await expect(service.sendCheckRequest(mockQrData, mockToken)).rejects.toThrow(
        'Failed to send check request to FNS'
      );
    });
  });

  describe('development mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.FNS_DEV_MODE = 'true';
    });

    it('should generate realistic mock data', async () => {
      const messageId = await service.sendCheckRequest(mockQrData, mockToken);
      const result = await service.getCheckResult(messageId, mockToken);

      expect(messageId).toMatch(/mock_message_/);
      expect(result.status).toBe('success');
      expect(result.receiptData).toHaveProperty('fiscalDocumentNumber');
      expect(result.receiptData).toHaveProperty('totalSum');
      expect(result.receiptData).toHaveProperty('dateTime');
    });

    it('should simulate processing delay in waitForResult', async () => {
      jest.useFakeTimers();

      const messageId = 'mock-message-id';
      const resultPromise = service.waitForResult(messageId, mockToken, 2);

      jest.advanceTimersByTime(2000);

      const result = await resultPromise;

      expect(result.status).toBe('success');

      jest.useRealTimers();
    });
  });
});