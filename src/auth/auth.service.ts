import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminsService } from 'src/admins/admins.service';
import { LoginAdminDto } from 'src/admins/dto/login-admin.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { TAllUsers } from './types/all-users.type';
import { UpdateCompanyDto } from 'src/companies/dto/update-company.dto';
import { CompaniesService } from 'src/companies/companies.service';
import { LoginCompanyDto } from 'src/companies/dto/login-company.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AdminDto } from 'src/admins/dto/admin.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly companiesService: CompaniesService,
    private readonly jwtService: JwtService,
  ) {}

  async validateToken(token: string): Promise<TAllUsers | null> {
    return this.jwtService.verify(token);
  }

  async getTokensByPayload(payload: Record<string, any>) {
    return {
      access: await this.jwtService.signAsync(payload),
      refresh: await this.jwtService.signAsync(payload, { expiresIn: '7d' }),
    };
  }

  async validateAdmin(username: string, password: string): Promise<AdminDto> {
    const admin = await this.adminsService.getAdminByUsername(username);
    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (isMatch) return admin;
    }
    return null;
  }

  async validateCompany(username: string, password: string): Promise<UpdateCompanyDto> {
    const company = await this.companiesService.getCompanyByUsername(username);
    if (company) {
      const isMatch = await bcrypt.compare(password, company.password);
      if (isMatch) return company;
    }
    return null;
  }

  async loginCompany(loginCompanyDto: LoginCompanyDto): Promise<LoginResponseDto> {
    const company = await this.validateCompany(loginCompanyDto.username, loginCompanyDto.password);
    if (company) {
      const payload = { id: company.id, username: company.username, role: company.role };

      return this.getTokensByPayload(payload);
    } else {
      throw new UnauthorizedException();
    }
  }

  async loginAdmin(loginAdminDto: LoginAdminDto): Promise<LoginResponseDto> {
    const admin = await this.validateAdmin(loginAdminDto.username, loginAdminDto.password);
    if (admin) {
      const payload = { id: admin.id, username: admin.username, role: admin.role };

      return this.getTokensByPayload(payload);
    } else {
      throw new UnauthorizedException();
    }
  }

  async refresh(refresh: string) {
    try {
      const payload = this.jwtService.verify(refresh);
      const { exp, iat, ...restPayload } = payload;
      return {
        access: await this.jwtService.signAsync(restPayload),
        refresh: await this.jwtService.signAsync(restPayload, { expiresIn: '7d' }),
      };
    } catch (error) {
      throw new UnauthorizedException();
    }
  }
}
