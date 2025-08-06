import { Test, TestingModule } from '@nestjs/testing';
import { FnsAuthService } from '../../src/fns/fns-auth.service';
import { FnsCheckService } from '../../src/fns/fns-check.service';
import { PrismaService } from '../../src/prisma.service';
import { Logger } from '@nestjs/common';
import axios from 'axios';

// Мокируем axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FNS API Scenarios (Based on Documentation)', () => {
  let fnsAuthService: FnsAuthService;
  let fnsCheckService: FnsCheckService;

  const mockPrismaService = {
    fnsToken: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FnsAuthService,
        FnsCheckService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    fnsAuthService = module.get<FnsAuthService>(FnsAuthService);
    fnsCheckService = module.get<FnsCheckService>(FnsCheckService);

    // Подавляем логи в тестах
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Очищаем кэш токенов
    (fnsAuthService as any).cachedToken = null;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Service Scenarios', () => {
    describe('Positive Scenario', () => {
      it('should authenticate successfully', async () => {
        const mockResponse = {
          data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <GetMessageResponse xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiMessageConsumerService/types/1.0">
                <Message>
                  <AuthResponse xmlns:ns3="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageProviderService/types/1.0" 
                               xmlns:ns2="urn://x-artefacts-gnivc-ru/ais3/kkt/AuthService/types/1.0" 
                               xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" 
                               xmlns="urn://x-artefacts-gnivc-ru/ais3/kkt/AuthService/types/1.0">
                    <ns2:Result>
                      <ns2:Token>c499717f309949d2b8719bf3040efd96</ns2:Token>
                      <ns2:ExpireTime>2021-01-21T14:52:13.202+03:00</ns2:ExpireTime>
                    </ns2:Result>
                  </AuthResponse>
                </Message>
              </GetMessageResponse>
            </soap:Body>
          </soap:Envelope>`,
        };

        mockedAxios.post.mockResolvedValue(mockResponse);
        mockPrismaService.fnsToken.upsert.mockResolvedValue({
          token: 'c499717f309949d2b8719bf3040efd96',
          expiresAt: new Date('2021-01-21T14:52:13.202+03:00'),
        });

        const token = await fnsAuthService.refreshToken();

        expect(token).toBe('c499717f309949d2b8719bf3040efd96');
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/open-api/AuthService/0.1'),
          expect.stringContaining('<tns:MasterToken>'),
          expect.any(Object)
        );
      });
    });

    describe('Timeout Error Scenario', () => {
      it('should handle timeout error', async () => {
        const timeoutResponse = {
          response: {
            status: 500,
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Произошел timeout ожидания ответа</faultstring>      
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(timeoutResponse);

        await expect(fnsAuthService.refreshToken()).rejects.toThrow(
          'FNS authentication failed'
        );
      });
    });

    describe('Invalid Request Scenario', () => {
      it('should handle invalid XML request', async () => {
        const invalidResponse = {
          response: {
            status: 500,
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Client</faultcode>
                  <faultstring>Unmarshalling Error: cvc-complex-type.2.4.a: Invalid content was found starting with element 'test'. One of '{WC[##other:"urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiMessageConsumerService/types/1.0"]}' is expected.</faultstring>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(invalidResponse);

        await expect(fnsAuthService.refreshToken()).rejects.toThrow(
          'FNS authentication failed'
        );
      });
    });

    describe('Access Denied Scenario', () => {
      it('should handle IP access denied', async () => {
        const accessDeniedResponse = {
          response: {
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Доступ к сервису для переданного IP, запрещен</faultstring>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(accessDeniedResponse);

        await expect(fnsAuthService.refreshToken()).rejects.toThrow(
          'IP address not whitelisted in FNS'
        );
      });
    });

    describe('Server Error Scenario', () => {
      it('should handle internal server error', async () => {
        const serverErrorResponse = {
          response: {
            status: 500,
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Произошла внутренняя ошибка 00c5b2ae-45b2-475d-9b49-9c9a88e53b97. При повторении ошибки обратитесь в службу технической поддержки.</faultstring>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(serverErrorResponse);

        await expect(fnsAuthService.refreshToken()).rejects.toThrow(
          'FNS authentication failed'
        );
      });
    });
  });

  describe('Service SendMessage Scenarios', () => {
    const mockQrData = {
      fn: '9287440300090728',
      fd: '77133',
      fp: '1482926127',
      sum: 240000,
      date: '2019-04-09T16:38:00',
      typeOperation: 1,
    };
    const mockToken = 'test-token';

    describe('Positive Scenario', () => {
      it('should send message successfully', async () => {
        const successResponse = {
          data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <SendMessageResponse xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
                <MessageId>d28f1970-1e8d-4fe4-8a39-8aab0af7885e</MessageId>
              </SendMessageResponse>
            </soap:Body>
          </soap:Envelope>`,
        };

        mockedAxios.post.mockResolvedValue(successResponse);

        const messageId = await fnsCheckService.sendCheckRequest(mockQrData, mockToken);

        expect(messageId).toBe('d28f1970-1e8d-4fe4-8a39-8aab0af7885e');
      });
    });

    describe('IP Access Denied Scenario', () => {
      it('should handle IP access denied for SendMessage', async () => {
        const ipDeniedResponse = {
          response: {
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Доступ к сервису для переданного IP, запрещен</faultstring>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(ipDeniedResponse);

        await expect(
          fnsCheckService.sendCheckRequest(mockQrData, mockToken)
        ).rejects.toThrow('IP address not whitelisted');
      });
    });

    describe('Token Access Denied Scenario', () => {
      it('should handle token access denied', async () => {
        const tokenDeniedResponse = {
          response: {
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Доступ к сервису для token запрещен</faultstring>
                  <detail>
                    <AuthenticationFault xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0"/>
                  </detail>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(tokenDeniedResponse);

        await expect(
          fnsCheckService.sendCheckRequest(mockQrData, mockToken)
        ).rejects.toThrow('Authentication failed');
      });
    });

    describe('Missing Headers Scenario', () => {
      it('should handle missing required headers', async () => {
        const missingHeadersResponse = {
          response: {
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Не удалось обнаружить требуемые заголовки в переданном запросе</faultstring>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(missingHeadersResponse);

        await expect(
          fnsCheckService.sendCheckRequest(mockQrData, mockToken)
        ).rejects.toThrow('Required headers missing');
      });
    });

    describe('Daily Limit Exceeded Scenario', () => {
      it('should handle daily request limit exceeded', async () => {
        const dailyLimitResponse = {
          response: {
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Превышен общий дневной лимит запросов, приложением TestAppId-1</faultstring>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(dailyLimitResponse);

        await expect(
          fnsCheckService.sendCheckRequest(mockQrData, mockToken)
        ).rejects.toThrow('Daily request limit exceeded');
      });
    });

    describe('Method Limit Exceeded Scenario', () => {
      it('should handle method request limit exceeded', async () => {
        const methodLimitResponse = {
          response: {
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Превышен лимит запросов метода ExampleRequest</faultstring>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(methodLimitResponse);

        await expect(
          fnsCheckService.sendCheckRequest(mockQrData, mockToken)
        ).rejects.toThrow('Method request limit exceeded');
      });
    });

    describe('Method Access Denied Scenario', () => {
      it('should handle method access denied', async () => {
        const methodDeniedResponse = {
          response: {
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Метод ExampleRequest отсутствует в списке доступа для переданного токена</faultstring>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(methodDeniedResponse);

        await expect(
          fnsCheckService.sendCheckRequest(mockQrData, mockToken)
        ).rejects.toThrow('Failed to send check request to FNS');
      });
    });
  });

  describe('Service GetMessage Scenarios', () => {
    const mockMessageId = '22cf901c-0ca8-4c01-befc-99f30bc005f0';
    const mockToken = 'test-token';

    describe('Processing Status Scenario', () => {
      it('should return processing status', async () => {
        const processingResponse = {
          data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <GetMessageResponse xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
                <ProcessingStatus>PROCESSING</ProcessingStatus>
              </GetMessageResponse>
            </soap:Body>
          </soap:Envelope>`,
        };

        mockedAxios.post.mockResolvedValue(processingResponse);

        const result = await fnsCheckService.getCheckResult(mockMessageId, mockToken);

        expect(result.status).toBe('processing');
        expect(result.processingStatus).toBe('PROCESSING');
      });
    });

    describe('Completed Status Scenario', () => {
      it('should return completed status with receipt data', async () => {
        const completedResponse = {
          data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <GetMessageResponse xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
                <ProcessingStatus>COMPLETED</ProcessingStatus>
                <Message>
                  <GetTicketResponse xmlns:ns3="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageProviderService/types/1.0" 
                                    xmlns:ns2="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0" 
                                    xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" 
                                    xmlns="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0">
                    <ns2:Result>
                      <ns2:Code>200</ns2:Code>
                      <ns2:Ticket>{"id":3474433105673519104,"ofdId":"ofd9"}</ns2:Ticket>             
                    </ns2:Result>
                  </GetTicketResponse>
                </Message>
              </GetMessageResponse>
            </soap:Body>
          </soap:Envelope>`,
        };

        mockedAxios.post.mockResolvedValue(completedResponse);

        const result = await fnsCheckService.getCheckResult(mockMessageId, mockToken);

        expect(result.status).toBe('success');
        expect(result.processingStatus).toBe('COMPLETED');
        expect(result.receiptData).toBeDefined();
      });
    });

    describe('Message Not Found Scenario', () => {
      it('should handle message not found error', async () => {
        const notFoundResponse = {
          response: {
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>По переданному MessageId: 5c3da8d7-cb72-4c4f-b4b8-aafbd1d1ef46 сообщение не найдено</faultstring>
                  <detail>
                    <MessageNotFoundFault xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0"/>
                  </detail>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(notFoundResponse);

        await expect(
          fnsCheckService.getCheckResult(mockMessageId, mockToken)
        ).rejects.toThrow('Message not found');
      });
    });

    describe('Rate Limiting Scenario', () => {
      it('should handle GetMessage rate limiting', async () => {
        const rateLimitResponse = {
          response: {
            status: 500,
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Превышено количество запросов метода GetMessage по уникальному MessageID. Повторите запрос позже.</faultstring>
                  <detail>
                    <RateLimitingFault xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
                      <errorCode>429</errorCode>
                    </RateLimitingFault>
                  </detail>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(rateLimitResponse);

        await expect(
          fnsCheckService.getCheckResult(mockMessageId, mockToken)
        ).rejects.toThrow('Failed to get check result from FNS');
      });
    });
  });

  describe('File Handling Scenarios', () => {
    const mockQrData = {
      fn: '9287440300090728',
      fd: '77133',
      fp: '1482926127',
      sum: 240000,
      date: '2019-04-09T16:38:00',
      typeOperation: 1,
    };
    const mockToken = 'test-token';

    describe('Invalid File Links Scenario', () => {
      it('should handle invalid number of file links', async () => {
        const invalidFileLinksResponse = {
          response: {
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>Установлено недопустимое количество ссылок на файлы в запросе SendMessageRequest.</faultstring>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(invalidFileLinksResponse);

        await expect(
          fnsCheckService.sendCheckRequest(mockQrData, mockToken)
        ).rejects.toThrow('Failed to send check request to FNS');
      });
    });

    describe('File Not Found Scenario', () => {
      it('should handle file not found error', async () => {
        const fileNotFoundResponse = {
          response: {
            data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <soap:Fault>
                  <faultcode>soap:Server</faultcode>
                  <faultstring>По переданной ссылке файл не найден</faultstring>
                  <detail>
                    <FileNotFoundFault xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0"/>
                  </detail>
                </soap:Fault>
              </soap:Body>
            </soap:Envelope>`,
          },
        };

        mockedAxios.post.mockRejectedValue(fileNotFoundResponse);

        await expect(
          fnsCheckService.sendCheckRequest(mockQrData, mockToken)
        ).rejects.toThrow('Failed to send check request to FNS');
      });
    });
  });

  describe('HTTP Level Error Scenarios', () => {
    it('should handle HTTP 429 rate limiting', async () => {
      const http429Error = {
        response: {
          status: 429,
          data: 'Too many requests',
          headers: {
            'retry-after': '60',
          },
        },
      };

      mockedAxios.post.mockRejectedValue(http429Error);

      await expect(
        fnsCheckService.sendCheckRequest(
          {
            fn: '9287440300090728',
            fd: '77133',
            fp: '1482926127',
            sum: 240000,
            date: '2019-04-09T16:38:00',
            typeOperation: 1,
          },
          'test-token'
        )
      ).rejects.toThrow('Rate limiting error from FNS');
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      };

      mockedAxios.post.mockRejectedValue(timeoutError);

      await expect(
        fnsCheckService.sendCheckRequest(
          {
            fn: '9287440300090728',
            fd: '77133',
            fp: '1482926127',
            sum: 240000,
            date: '2019-04-09T16:38:00',
            typeOperation: 1,
          },
          'test-token'
        )
      ).rejects.toThrow('Failed to send check request to FNS');
    });
  });

  describe('Digital Signature Scenarios', () => {
    it('should handle digital signature verification failure', async () => {
      const signatureFailResponse = {
        response: {
          data: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <soap:Fault>
                <faultcode>soap:Server</faultcode>
                <faultstring>Значение ЭЦП не прошло проверку.</faultstring>
              </soap:Fault>
            </soap:Body>
          </soap:Envelope>`,
        },
      };

      mockedAxios.post.mockRejectedValue(signatureFailResponse);

      await expect(
        fnsCheckService.sendCheckRequest(
          {
            fn: '9287440300090728',
            fd: '77133',
            fp: '1482926127',
            sum: 240000,
            date: '2019-04-09T16:38:00',
            typeOperation: 1,
          },
          'test-token'
        )
      ).rejects.toThrow('Digital signature verification failed');
    });
  });

  describe('Service Configuration and Headers', () => {
    it('should send requests with correct headers according to documentation', async () => {
      const mockResponse = {
        data: `<soap:Envelope><soap:Body><SendMessageResponse><MessageId>test-id</MessageId></SendMessageResponse></soap:Body></soap:Envelope>`,
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await fnsCheckService.sendCheckRequest(
        {
          fn: '9287440300090728',
          fd: '77133',
          fp: '1482926127',
          sum: 240000,
          date: '2019-04-09T16:38:00',
          typeOperation: 1,
        },
        'test-token'
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': 'urn:SendMessageRequest',
            'FNS-OpenApi-Token': 'test-token',
            // Проверяем, что deprecated FNS-OpenApi-UserToken НЕ передается
          },
          timeout: 30000,
        })
      );

      const headers = mockedAxios.post.mock.calls[0][2].headers;
      expect(headers).not.toHaveProperty('FNS-OpenApi-UserToken');
    });

    it('should use correct namespaces according to documentation', async () => {
      const mockResponse = {
        data: `<soap:Envelope><soap:Body><SendMessageResponse><MessageId>test-id</MessageId></SendMessageResponse></soap:Body></soap:Envelope>`,
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await fnsCheckService.sendCheckRequest(
        {
          fn: '9287440300090728',
          fd: '77133',
          fp: '1482926127',
          sum: 240000,
          date: '2019-04-09T16:38:00',
          typeOperation: 1,
        },
        'test-token'
      );

      const soapRequest = mockedAxios.post.mock.calls[0][1];

      // Проверяем правильные namespaces из документации
      expect(soapRequest).toContain(
        'urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0'
      );
      expect(soapRequest).toContain(
        'urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0'
      );
    });
  });
});