import { 
  Controller, 
  Get, 
  Delete, 
  Put,
  Param, 
  Query, 
  Body,
  UseGuards, 
  Request,
  Logger,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Admin FNS Management')
@Controller('admin/fns')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
export class AdminFnsController {
  private readonly logger = new Logger(AdminFnsController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('requests')
  @ApiOperation({ 
    summary: 'Получить список запросов к ФНС',
    description: 'Получает список всех запросов к ФНС с возможностью фильтрации'
  })
  @ApiQuery({ name: 'status', required: false, description: 'Фильтр по статусу' })
  @ApiQuery({ name: 'customerId', required: false, description: 'Фильтр по ID клиента' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество записей', example: 50 })
  @ApiResponse({ status: 200, description: 'Список запросов к ФНС' })
  async getFnsRequests(
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
    @Request() req?: any
  ) {
    this.logger.log(`Getting FNS requests for admin ${req.user?.id}`);
    
    const whereClause: any = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (customerId) {
      whereClause.customerId = parseInt(customerId);
    }

    const requests = await this.prisma.fnsRequest.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
        promotion: {
          select: {
            promotionId: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit ? parseInt(limit) : 100,
    });

    return requests;
  }

  @Get('requests/:id')
  @ApiOperation({ 
    summary: 'Получить детальную информацию о запросе к ФНС',
    description: 'Получает подробную информацию о конкретном запросе'
  })
  @ApiParam({ name: 'id', description: 'ID запроса к ФНС' })
  @ApiResponse({ status: 200, description: 'Детальная информация о запросе' })
  async getFnsRequest(@Param('id') id: string) {
    const request = await this.prisma.fnsRequest.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
        promotion: {
          select: {
            promotionId: true,
            name: true,
          },
        },
        receipt: {
          include: {
            products: {
              include: {
                product: true,
                offer: true,
              },
            },
          },
        },
        cashbacks: true,
      },
    });

    if (!request) {
      throw new BadRequestException('FNS request not found');
    }

    return request;
  }

  @Put('requests/:id/reset')
  @ApiOperation({ 
    summary: 'Сбросить статус запроса для повторного сканирования',
    description: 'Сбрасывает статус запроса к ФНС, позволяя пересканировать чек'
  })
  @ApiParam({ name: 'id', description: 'ID запроса к ФНС' })
  @ApiResponse({ status: 200, description: 'Статус запроса сброшен' })
  async resetFnsRequest(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req?: any
  ) {
    this.logger.log(`Admin ${req.user?.id} resetting FNS request ${id}, reason: ${body.reason}`);

    const request = await this.prisma.fnsRequest.findUnique({
      where: { id },
      include: { cashbacks: true },
    });

    if (!request) {
      throw new BadRequestException('FNS request not found');
    }

    if (request.cashbacks && request.cashbacks.length > 0) {
      for (const cashback of request.cashbacks) {
        // В новой логике кешбеки не отменяются, они просто начисляются
        // Удаляем кешбек из базы данных
        await this.prisma.cashback.delete({
          where: { id: cashback.id },
        });

        if (cashback.customerId) {
          await this.prisma.customer.update({
            where: { id: cashback.customerId },
            data: {
              bonuses: {
                decrement: cashback.amount,
              },
            },
          });
        }
      }
    }

    const updatedRequest = await this.prisma.fnsRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        cashbackAwarded: false,
        cashbackAmount: 0,
        fnsResponse: Object.assign(
          request.fnsResponse || {},
          {
            adminReset: true,
            resetReason: body.reason,
            resetBy: req.user?.id,
            resetAt: new Date().toISOString(),
          }
        ),
      },
    });

    this.logger.log(`FNS request ${id} reset successfully by admin ${req.user?.id}`);

    return {
      success: true,
      message: 'FNS request reset successfully',
      request: updatedRequest,
    };
  }

  @Delete('requests/:id')
  @ApiOperation({ 
    summary: 'Удалить запрос к ФНС',
    description: 'Полностью удаляет запрос к ФНС из системы (осторожно!)'
  })
  @ApiParam({ name: 'id', description: 'ID запроса к ФНС' })
  @ApiResponse({ status: 200, description: 'Запрос удален' })
  async deleteFnsRequest(
    @Param('id') id: string,
    @Body() body: { reason: string; confirm: boolean },
    @Request() req?: any
  ) {

    this.logger.warn(`Admin ${req.user?.id} deleting FNS request ${id}, reason: ${body.reason}`);

    const request = await this.prisma.fnsRequest.findUnique({
      where: { id },
      include: { 
        cashbacks: true,
        receipt: true,
      },
    });

    if (!request) {
      throw new BadRequestException('FNS request not found');
    }

    this.logger.log(`FNS request ${id} has ${request.cashbacks?.length || 0} cashbacks and receipt: ${request.receipt ? `ID ${request.receipt.id}` : 'none'}`);

    await this.prisma.$transaction(async (tx) => {
      if (request.cashbacks && request.cashbacks.length > 0) {
        for (const cashback of request.cashbacks) {
          if (cashback.customerId) {
            await tx.customer.update({
              where: { id: cashback.customerId },
              data: {
                bonuses: {
                  decrement: cashback.amount,
                },
              },
            });
          }

          await tx.cashbackItem.deleteMany({
            where: { cashbackId: cashback.id },
          });
          
          await tx.cashback.delete({
            where: { id: cashback.id },
          });
        }
      }

      if (request.receipt) {
        this.logger.log(`Deleting receipt ${request.receipt.id} and its products`);
        
        const deletedProducts = await tx.receiptProduct.deleteMany({
          where: { receiptId: request.receipt.id },
        });
        this.logger.log(`Deleted ${deletedProducts.count} receipt products`);
        
        await tx.receipt.delete({
          where: { id: request.receipt.id },
        });
        this.logger.log(`Deleted receipt ${request.receipt.id}`);
      } else {
        this.logger.log(`No receipt to delete for FNS request ${id}`);
      }

      await tx.fnsRequest.delete({
        where: { id },
      });
    });

    this.logger.warn(`FNS request ${id} deleted by admin ${req.user?.id}`);

    return {
      success: true,
      message: 'FNS request deleted successfully',
    };
  }

  @Get('requests/search')
  @ApiOperation({ 
    summary: 'Поиск запросов по QR данным',
    description: 'Находит запросы по fn, fd, fp для диагностики дубликатов'
  })
  @ApiQuery({ name: 'fn', required: false, description: 'Федеральный номер' })
  @ApiQuery({ name: 'fd', required: false, description: 'Федеральный документ' })
  @ApiQuery({ name: 'fp', required: false, description: 'Федеральный признак' })
  @ApiResponse({ status: 200, description: 'Найденные запросы' })
  async searchFnsRequests(
    @Query('fn') fn?: string,
    @Query('fd') fd?: string,
    @Query('fp') fp?: string
  ) {
    if (!fn && !fd && !fp) {
      throw new BadRequestException('At least one search parameter (fn, fd, fp) is required');
    }

    const whereConditions: any[] = [];

    if (fn) {
      whereConditions.push({
        qrData: {
          path: ['fn'],
          equals: fn,
        },
      });
    }

    if (fd) {
      whereConditions.push({
        qrData: {
          path: ['fd'],
          equals: fd,
        },
      });
    }

    if (fp) {
      whereConditions.push({
        qrData: {
          path: ['fp'],
          equals: fp,
        },
      });
    }

    const requests = await this.prisma.fnsRequest.findMany({
      where: {
        AND: whereConditions,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
          },
        },
        promotion: {
          select: {
            promotionId: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      found: requests.length,
      requests,
    };
  }
}
