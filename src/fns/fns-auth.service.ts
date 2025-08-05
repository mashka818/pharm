import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios from 'axios';

@Injectable()
export class FnsAuthService {
  private readonly logger = new Logger(FnsAuthService.name);
  private cachedToken: { token: string; expiresAt: Date } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getValidToken(): Promise<string> {
    if (this.isTokenValid()) {
      return this.cachedToken.token;
    }

    return this.refreshToken();
  }

  async refreshToken(): Promise<string> {
    this.logger.log('Refreshing FNS token');

    try {
      const token = await this.makeAuthRequest();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      this.cachedToken = { token, expiresAt };

      await this.prisma.fnsToken.upsert({
        where: { token },
        update: { expiresAt },
        create: { token, expiresAt },
      });

      return token;
    } catch (error) {
      this.logger.error('Error refreshing FNS token:', error);
      throw new Error('Failed to refresh FNS token');
    }
  }

  private isTokenValid(): boolean {
    if (!this.cachedToken) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(this.cachedToken.expiresAt.getTime() - 60 * 1000);
    
    return now < expiresAt;
  }

  private async makeAuthRequest(): Promise<string> {
    // Используем корректный токен из данных сервиса
    const masterToken = process.env.FTX_TOKEN || 'LFgDIA4yBZjW6h174iwVDcRoDHhjmpuFLtAX3kHPT9ctgggajk36aLJIzIcs2kZyKvTqLy4rSEHi7KOgY0fuNHKPbGCekDg9qjpin04K4ZyfolqtwDBZ6f6Isja3MMWe';
    const authServiceUrl = process.env.FTX_API_URL || 'https://openapi.nalog.ru:8090';
    const authEndpoint = `${authServiceUrl}/open-api/AuthService/0.1`;

    if (!masterToken) {
      throw new Error('FTX_TOKEN not configured');
    }

    const soapRequest = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiMessageConsumerService/types/1.0">
        <soapenv:Header/>
        <soapenv:Body>
          <ns:GetMessageRequest>
            <ns:Message>
              <tns:AuthRequest xmlns:tns="urn://x-artefacts-gnivc-ru/ais3/kkt/AuthService/types/1.0">
                <tns:AuthAppInfo>
                  <tns:MasterToken>${masterToken}</tns:MasterToken>
                </tns:AuthAppInfo>
              </tns:AuthRequest>
            </ns:Message>
          </ns:GetMessageRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    try {
      this.logger.log(`Attempting FNS authentication with endpoint: ${authEndpoint}`);
      
      const response = await axios.post(authEndpoint, soapRequest, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:GetMessageRequest',
        },
        timeout: 30000,
      });

      const token = this.parseAuthResponse(response.data);
      this.logger.log('Successfully obtained FNS token');
      return token;
    } catch (error) {
      this.logger.error('SOAP auth request failed:', error.response?.data || error.message);
      
      // Специальная обработка ошибки доступа по IP
      if (error.response?.data?.includes('Доступ к сервису для переданного IP, запрещен')) {
        this.logger.error('IP address is not whitelisted in FNS. Please contact FNS support to add your server IP to the whitelist.');
        throw new Error('IP address not whitelisted in FNS. Contact support to add IP: ' + (process.env.PROD_SERVER_IP || 'current server IP'));
      }
      
      throw new Error('FNS authentication failed');
    }
  }

  private parseAuthResponse(xmlResponse: string): string {
    const tokenMatch = xmlResponse.match(/<ns2:Token>([^<]+)<\/ns2:Token>/);
    if (tokenMatch) {
      return tokenMatch[1];
    }

    const altTokenMatch = xmlResponse.match(/<Token>([^<]+)<\/Token>/);
    if (altTokenMatch) {
      return altTokenMatch[1];
    }

    throw new Error('Failed to parse token from FNS response');
  }

  async loadTokenFromDb(): Promise<void> {
    try {
      const tokenRecord = await this.prisma.fnsToken.findFirst({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (tokenRecord) {
        this.cachedToken = {
          token: tokenRecord.token,
          expiresAt: tokenRecord.expiresAt,
        };
      }
    } catch (error) {
      this.logger.error('Error loading token from DB:', error);
    }
  }
} 