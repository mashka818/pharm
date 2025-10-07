import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCashbackTicketDto, UpdateCashbackTicketDto, CashbackTicketDto, TicketStatus } from './dto/cashback-ticket.dto';

@Injectable()
export class CashbackTicketsService {
  constructor(private prisma: PrismaService) {}

  async createTicket(createTicketDto: CreateCashbackTicketDto, customerId: number): Promise<CashbackTicketDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { promotion: true },
    });

    if (!customer) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (customer.bonuses <= 0) {
      throw new BadRequestException('У вас нет бонусов для вывода');
    }

    if (createTicketDto.amount <= 0) {
      throw new BadRequestException('Сумма должна быть больше 0');
    }

    if (createTicketDto.amount > customer.bonuses) {
      throw new BadRequestException('Недостаточно бонусов для вывода');
    }

    return await (this.prisma as any).cashbackTicket.create({
      data: {
        customerId: customerId,
        promotionId: customer.promotionId,
        amount: createTicketDto.amount,
        status: 'pending',
      },
    });
  }

  async getCustomerTickets(customerId: number): Promise<CashbackTicketDto[]> {
    return await (this.prisma as any).cashbackTicket.findMany({
      where: {
        customerId: customerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getAllTickets(): Promise<CashbackTicketDto[]> {
    return await (this.prisma as any).cashbackTicket.findMany({
      include: {
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
    return await (this.prisma as any).cashbackTicket.findMany({
      where: {
        status: 'pending',
      },
      include: {
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
    const ticket = await (this.prisma as any).cashbackTicket.findUnique({
      where: { id: ticketId },
      include: {
        customer: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Тикет не найден');
    }

    if (ticket.status !== 'pending') {
      throw new BadRequestException('Тикет уже обработан');
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedTicket = await (tx as any).cashbackTicket.update({
        where: { id: ticketId },
        data: {
          status: updateTicketDto.status,
          adminId: adminId,
          adminComment: updateTicketDto.adminComment,
          resolvedAt: new Date(),
        },
      });

      if (updateTicketDto.status === 'approved') {
        await tx.customer.update({
          where: { id: ticket.customerId },
          data: {
            bonuses: {
              decrement: ticket.amount,
            },
          },
        });
      }

      return updatedTicket;
    });
  }

  async getTicketById(ticketId: number): Promise<CashbackTicketDto> {
    const ticket = await (this.prisma as any).cashbackTicket.findUnique({
      where: { id: ticketId },
      include: {
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
