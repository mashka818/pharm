import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginAdminDto } from './dto/login-admin.dto';
import { AdminDto } from './dto/admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminsService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.createRootAdmin();
  }

  async getAdminByUsername(username: LoginAdminDto['username']): Promise<AdminDto> {
    return this.prisma.admin.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        role: true,
        password: true,
      },
    });
  }

  async create(adminDto: LoginAdminDto): Promise<UpdateAdminDto> {
    const sameAdmin = await this.getAdminByUsername(adminDto.username);
    if (sameAdmin) {
      throw new ConflictException(`Admin with username ${adminDto.username} already exists`);
    }
    const password = adminDto.password;
    const hashedPassword = await bcrypt.hash(password, +process.env.SALT);

    const createdAdmin = await this.prisma.admin.create({
      data: { ...adminDto, role: 'ADMIN', password: hashedPassword },
    });
    const { password: _, ...restCreatedAdmin } = createdAdmin;
    return restCreatedAdmin;
  }

  async remove(id: number) {
    const admin = await this.getOne(id);

    if (!admin) {
      throw new NotFoundException(`Admin with id:${id} not found`);
    }

    if (admin.username === process.env.ROOT_ADMIN_USERNAME) {
      throw new ForbiddenException('You cannot delete root admin');
    }

    await this.prisma.admin.delete({
      where: { id },
    });

    return `Admin with id:${id} is deleted`;
  }

  async update(adminDto: UpdateAdminDto): Promise<UpdateAdminDto> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminDto.id },
    });

    if (!admin) {
      throw new NotFoundException(`Admin with id:${adminDto.id} not found`);
    }

    if (admin.username === process.env.ROOT_ADMIN_USERNAME) {
      throw new ForbiddenException('You cannot update root admin');
    }

    const updatedAdmin = await this.prisma.admin.update({
      where: { id: adminDto.id },
      data: adminDto,
    });

    const { password, ...restUpdatedAdmin } = updatedAdmin;
    return restUpdatedAdmin;
  }

  async getOne(id: number): Promise<UpdateAdminDto> {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
    });
    if (!admin) {
      throw new NotFoundException(`Admin with id:${id} not found`);
    }
    const { password, ...restAdmin } = admin;
    return restAdmin;
  }

  async getAll(): Promise<UpdateAdminDto[]> {
    const admins = await this.prisma.admin.findMany();
    return admins.map(({ password, ...rest }) => rest);
  }

  async createRootAdmin() {
    const username = process.env.ROOT_ADMIN_USERNAME;
    const admin = await this.getAdminByUsername(username);
    if (!admin) {
      const password = process.env.ROOT_ADMIN_PASSWORD;
      const hashedPassword = await bcrypt.hash(password, +process.env.SALT);

      const rootAdmin = await this.prisma.admin.create({
        data: {
          username,
          password: hashedPassword,
          role: 'ADMIN',
        },
      });
      console.log(rootAdmin);
    } else {
      console.log('Root Admin exist');
    }
  }
}
