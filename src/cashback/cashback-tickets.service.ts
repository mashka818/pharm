import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateCashbackTicketDto, UpdateCashbackTicketDto, CashbackTicketDto, TicketStatus } from './dto/cashback-ticket.dto';

@Injectable()
export class CashbackTicketsService {
  constructor(private prisma: PrismaService) {}

  async createTicket(createTicketDto: CreateCashbackTicketDto, customerId: number): Promise<CashbackTicketDto> {
    const cashback = await this.prisma.cashback.findFirst({
      where: {
        id: createTicketDto.cashbackId,
        customerId: customerId,
        status: 'pending',
      },
      include: {
        customer: true,
        promotion: true,
      },
    });

    if (!cashback) {
      throw new NotFoundException('Кешбек не найден или уже обработан');
    }

    const existingTicket = await this.prisma.cashbackTicket.findFirst({
      where: {
        cashbackId: createTicketDto.cashbackId,
        status: 'pending',
      },
    });

    if (existingTicket) {
      throw new BadRequestException('Тикет для этого кешбека уже существует');
    }

    return await this.prisma.cashbackTicket.create({
      data: {
        cashbackId: createTicketDto.cashbackId,
        customerId: customerId,
        promotionId: cashback.promotionId,
        status: 'pending',
      },
    });
  }

  async getCustomerTickets(customerId: number): Promise<CashbackTicketDto[]> {
    return await this.prisma.cashbackTicket.findMany({
      where: {
        customerId: customerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getAllTickets(): Promise<CashbackTicketDto[]> {
    return await this.prisma.cashbackTicket.findMany({
      include: {
        cashback: {
          include: {
            customer: true,
            items: true,
          },
        },
        customer: true,
        promotion: true,
        admin: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getPendingTickets(): Promise<CashbackTicketDto[]> {
    return await this.prisma.cashbackTicket.findMany({
      where: {
        status: 'pending',
      },
      include: {
        cashback: {
          include: {
            customer: true,
            items: true,
          },
        },
        customer: true,
        promotion: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async updateTicketStatus(
    ticketId: number,
    updateTicketDto: UpdateCashbackTicketDto,
    adminId: number,
  ): Promise<CashbackTicketDto> {
    const ticket = await this.prisma.cashbackTicket.findUnique({
      where: { id: ticketId },
      include: {
        cashback: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Тикет не найден');
    }

    if (ticket.status !== 'pending') {
      throw new BadRequestException('Тикет уже обработан');
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.cashbackTicket.update({
        where: { id: ticketId },
        data: {
          status: updateTicketDto.status,
          adminId: adminId,
          adminComment: updateTicketDto.adminComment,
          resolvedAt: new Date(),
        },
      });

      if (updateTicketDto.status === 'approved') {
        await tx.cashback.update({
          where: { id: ticket.cashbackId },
          data: {
            status: 'active',
          },
        });
      } else if (updateTicketDto.status === 'rejected') {
        await tx.cashback.update({
          where: { id: ticket.cashbackId },
          data: {
            status: 'cancelled',
            reason: updateTicketDto.adminComment || 'Отклонено администратором',
            cancelledBy: adminId,
            cancelledAt: new Date(),
          },
        });
      }

      return updatedTicket;
    });
  }

  async getTicketById(ticketId: number): Promise<CashbackTicketDto> {
    const ticket = await this.prisma.cashbackTicket.findUnique({
      where: { id: ticketId },
      include: {
        cashback: {
          include: {
            customer: true,
            items: true,
          },
        },
        customer: true,
        promotion: true,
        admin: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Тикет не найден');
    }

    return ticket;
  }
}
