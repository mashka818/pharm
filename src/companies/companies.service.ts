import { Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { PrismaService } from 'src/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PromotionsService } from 'src/promotions/promotions.service';
import * as bcrypt from 'bcrypt';

@UseGuards(AdminGuard)
@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private promotionService: PromotionsService,
  ) {}

  async getCompanyByUsername(username: UpdateCompanyDto['username']): Promise<UpdateCompanyDto> {
    return this.prisma.company.findUnique({
      where: { username },
    });
  }

  async create(createCompanyDto: CreateCompanyDto): Promise<UpdateCompanyDto> {
    const promotion = await this.promotionService.findOneByPromotionId(
      createCompanyDto.promotionId,
    );
    if (!promotion) {
      throw new NotFoundException(`Promotion with promotionId:${promotion.promotionId} not found`);
    }
    const hashedPassword = await bcrypt.hash(createCompanyDto.password, +process.env.SALT);
    return this.prisma.company.create({
      data: { ...createCompanyDto, role: 'COMPANY', password: hashedPassword },
    });
  }

  async getAll(): Promise<UpdateCompanyDto[]> {
    return this.prisma.company.findMany();
  }

  async getOne(id: number): Promise<UpdateCompanyDto> {
    return this.prisma.company.findUnique({ where: { id } });
  }

  async update(updateCompanyDto: UpdateCompanyDto): Promise<UpdateCompanyDto> {
    const company = this.prisma.company.findUnique({ where: { id: updateCompanyDto.id } });
    if (!company) {
      throw new NotFoundException(`Promotion with id:${updateCompanyDto.id} not found`);
    }

    const { promotion, ...restData } = updateCompanyDto;

    const { password } = restData;
    if (password.at(0) !== '$') {
      restData.password = await bcrypt.hash(password, +process.env.SALT);
    }

    return this.prisma.company.update({
      where: { id: updateCompanyDto.id },
      data: restData,
    });
  }

  async remove(id: number) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(`Company with id:${id} not found`);
    }

    await this.prisma.company.delete({
      where: { id },
    });

    return `Company with id:${id} is deleted`;
  }
}
