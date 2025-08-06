import { Test, TestingModule } from '@nestjs/testing';
import { FnsAuthService } from '../../src/fns/fns-auth.service';
import { PrismaService } from '../../src/prisma.service';
import { Logger } from '@nestjs/common';
import axios from 'axios';

// Мокируем axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FnsAuthService', () => {
  let service: FnsAuthService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockFnsToken = {
    token: 'test-fns-token-12345',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      fnsToken: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FnsAuthService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FnsAuthService>(FnsAuthService);
    prismaService = module.get(PrismaService);

    // Подавляем логи в тестах
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Очищаем кэш перед каждым тестом
    (service as any).cachedToken = null;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getValidToken', () => {
    it('should return cached token if valid', async () => {
      // Устанавливаем кэшированный токен
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      (service as any).cachedToken = {
        token: 'cached-token',
        expiresAt: futureDate,
      };

      const result = await service.getValidToken();

      expect(result).toBe('cached-token');
    });

    it('should refresh token if cache is empty', async () => {
      const mockResponse = {
        data: '<soap:Envelope><soap:Body><GetMessageResponse><Message><AuthResponse><ns2:Result><ns2:Token>new-token</ns2:Token></ns2:Result></AuthResponse></Message></GetMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);
      prismaService.fnsToken.upsert.mockResolvedValue(mockFnsToken);

      const result = await service.getValidToken();

      expect(result).toBe('new-token');
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should refresh token if cached token is expired', async () => {
      // Устанавливаем просроченный токен
      const pastDate = new Date(Date.now() - 10 * 60 * 1000);
      (service as any).cachedToken = {
        token: 'expired-token',
        expiresAt: pastDate,
      };

      const mockResponse = {
        data: '<soap:Envelope><soap:Body><GetMessageResponse><Message><AuthResponse><ns2:Result><ns2:Token>refreshed-token</ns2:Token></ns2:Result></AuthResponse></Message></GetMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);
      prismaService.fnsToken.upsert.mockResolvedValue(mockFnsToken);

      const result = await service.getValidToken();

      expect(result).toBe('refreshed-token');
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const mockResponse = {
        data: '<soap:Envelope><soap:Body><GetMessageResponse><Message><AuthResponse><ns2:Result><ns2:Token>test-token-123</ns2:Token></ns2:Result></AuthResponse></Message></GetMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);
      prismaService.fnsToken.upsert.mockResolvedValue(mockFnsToken);

      const result = await service.refreshToken();

      expect(result).toBe('test-token-123');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/open-api/AuthService/0.1'),
        expect.stringContaining('<tns:MasterToken>'),
        expect.objectContaining({
          headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': 'urn:GetMessageRequest',
          },
          timeout: 30000,
        })
      );
      expect(prismaService.fnsToken.upsert).toHaveBeenCalled();
    });

    it('should handle IP blocking error', async () => {
      const errorResponse = {
        response: {
          data: '<soap:Envelope><soap:Body><soap:Fault><faultstring>Доступ к сервису для переданного IP, запрещен</faultstring></soap:Fault></soap:Body></soap:Envelope>',
        },
      };

      mockedAxios.post.mockRejectedValue(errorResponse);

      await expect(service.refreshToken()).rejects.toThrow(
        'IP address not whitelisted in FNS'
      );
    });

    it('should handle timeout errors', async () => {
      const timeoutError = {
        response: {
          data: '<soap:Envelope><soap:Body><soap:Fault><faultstring>Произошел timeout ожидания ответа</faultstring></soap:Fault></soap:Body></soap:Envelope>',
        },
      };

      mockedAxios.post.mockRejectedValue(timeoutError);

      await expect(service.refreshToken()).rejects.toThrow(
        'FNS authentication failed'
      );
    });

    it('should handle invalid response format', async () => {
      const invalidResponse = {
        data: '<invalid>response</invalid>',
      };

      mockedAxios.post.mockResolvedValue(invalidResponse);

      await expect(service.refreshToken()).rejects.toThrow(
        'Failed to refresh FNS token'
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      mockedAxios.post.mockRejectedValue(networkError);

      await expect(service.refreshToken()).rejects.toThrow(
        'Failed to refresh FNS token'
      );
    });
  });

  describe('parseAuthResponse', () => {
    it('should parse token from standard response format', () => {
      const xmlResponse = '<soap:Envelope><soap:Body><GetMessageResponse><Message><AuthResponse><ns2:Result><ns2:Token>parsed-token-123</ns2:Token></ns2:Result></AuthResponse></Message></GetMessageResponse></soap:Body></soap:Envelope>';

      const result = (service as any).parseAuthResponse(xmlResponse);

      expect(result).toBe('parsed-token-123');
    });

    it('should parse token from alternative response format', () => {
      const xmlResponse = '<soap:Envelope><soap:Body><AuthResponse><Result><Token>alt-token-456</Token></Result></AuthResponse></soap:Body></soap:Envelope>';

      const result = (service as any).parseAuthResponse(xmlResponse);

      expect(result).toBe('alt-token-456');
    });

    it('should throw error if token not found in response', () => {
      const xmlResponse = '<soap:Envelope><soap:Body><Error>No token</Error></soap:Body></soap:Envelope>';

      expect(() => {
        (service as any).parseAuthResponse(xmlResponse);
      }).toThrow('Failed to parse token from FNS response');
    });
  });

  describe('loadTokenFromDb', () => {
    it('should load valid token from database', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      const mockDbToken = {
        token: 'db-token',
        expiresAt: futureDate,
        createdAt: new Date(),
      };

      prismaService.fnsToken.findFirst.mockResolvedValue(mockDbToken);

      await service.loadTokenFromDb();

      expect((service as any).cachedToken).toEqual({
        token: 'db-token',
        expiresAt: futureDate,
      });
    });

    it('should not load expired token from database', async () => {
      prismaService.fnsToken.findFirst.mockResolvedValue(null);

      await service.loadTokenFromDb();

      expect((service as any).cachedToken).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      prismaService.fnsToken.findFirst.mockRejectedValue(new Error('DB Error'));

      await service.loadTokenFromDb();

      expect((service as any).cachedToken).toBeNull();
    });
  });

  describe('token validation', () => {
    it('should consider token invalid if it expires in less than 1 minute', async () => {
      const soonExpiringDate = new Date(Date.now() + 30 * 1000); // 30 seconds
      (service as any).cachedToken = {
        token: 'soon-expiring-token',
        expiresAt: soonExpiringDate,
      };

      const mockResponse = {
        data: '<soap:Envelope><soap:Body><GetMessageResponse><Message><AuthResponse><ns2:Result><ns2:Token>new-token</ns2:Token></ns2:Result></AuthResponse></Message></GetMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);
      prismaService.fnsToken.upsert.mockResolvedValue(mockFnsToken);

      const result = await service.getValidToken();

      expect(result).toBe('new-token');
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should use cached token if it has more than 1 minute left', async () => {
      const validDate = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
      (service as any).cachedToken = {
        token: 'valid-token',
        expiresAt: validDate,
      };

      const result = await service.getValidToken();

      expect(result).toBe('valid-token');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use environment variables for configuration', async () => {
      const originalEnv = process.env;
      process.env.FTX_TOKEN = 'custom-master-token';
      process.env.FTX_API_URL = 'https://custom-api.example.com';

      const mockResponse = {
        data: '<soap:Envelope><soap:Body><GetMessageResponse><Message><AuthResponse><ns2:Result><ns2:Token>env-token</ns2:Token></ns2:Result></AuthResponse></Message></GetMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);
      prismaService.fnsToken.upsert.mockResolvedValue(mockFnsToken);

      await service.refreshToken();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://custom-api.example.com/open-api/AuthService/0.1',
        expect.stringContaining('custom-master-token'),
        expect.any(Object)
      );

      process.env = originalEnv;
    });

    it('should use default values if environment variables not set', async () => {
      const originalEnv = process.env;
      delete process.env.FTX_TOKEN;
      delete process.env.FTX_API_URL;

      const mockResponse = {
        data: '<soap:Envelope><soap:Body><GetMessageResponse><Message><AuthResponse><ns2:Result><ns2:Token>default-token</ns2:Token></ns2:Result></AuthResponse></Message></GetMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);
      prismaService.fnsToken.upsert.mockResolvedValue(mockFnsToken);

      await service.refreshToken();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://openapi.nalog.ru:8090/open-api/AuthService/0.1',
        expect.stringContaining('LFgDIA4yBZjW6h174iwVDcRoDHhjmpuFLtAX3kHPT9ctgggajk36aLJIzIcs2kZyKvTqLy4rSEHi7KOgY0fuNHKPbGCekDg9qjpin04K4ZyfolqtwDBZ6f6Isja3MMWe'),
        expect.any(Object)
      );

      process.env = originalEnv;
    });
  });

  describe('SOAP request format', () => {
    it('should generate correct SOAP request structure', async () => {
      const mockResponse = {
        data: '<soap:Envelope><soap:Body><GetMessageResponse><Message><AuthResponse><ns2:Result><ns2:Token>soap-token</ns2:Token></ns2:Result></AuthResponse></Message></GetMessageResponse></soap:Body></soap:Envelope>',
      };

      mockedAxios.post.mockResolvedValue(mockResponse);
      prismaService.fnsToken.upsert.mockResolvedValue(mockFnsToken);

      await service.refreshToken();

      const soapRequest = mockedAxios.post.mock.calls[0][1];

      // Проверяем структуру SOAP запроса
      expect(soapRequest).toContain('<soapenv:Envelope');
      expect(soapRequest).toContain('xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"');
      expect(soapRequest).toContain('<ns:GetMessageRequest>');
      expect(soapRequest).toContain('<tns:AuthRequest');
      expect(soapRequest).toContain('<tns:MasterToken>');
      expect(soapRequest).toContain('urn://x-artefacts-gnivc-ru/ais3/kkt/AuthService/types/1.0');
    });
  });
});