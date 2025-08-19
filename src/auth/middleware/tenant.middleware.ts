import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma.service';

export interface RequestWithTenant extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    promotionId: string;
    name: string;
    surname: string;
  };
  tenant?: {
    promotionId: string;
    name: string;
    domain: string;
  };
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: RequestWithTenant, res: Response, next: NextFunction) {
    const host = req.get('host') || req.hostname;

    try {
      // Ищем промоакцию по домену
      const promotion = await this.prisma.promotion.findFirst({
        where: {
          domain: {
            contains: host,
          },
        },
        select: {
          promotionId: true,
          name: true,
          domain: true,
        },
      });

      if (promotion) {
        req.tenant = promotion;
      } else {
        // Если домен не найден, используем промоакцию по умолчанию или ошибку
        req.tenant = {
          promotionId: 'default-promotion',
          name: 'Default Network',
          domain: host,
        };
      }

      next();
    } catch (error) {
      console.error('Error in TenantMiddleware:', error);
      next();
    }
  }
}