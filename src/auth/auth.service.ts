import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminsService } from 'src/admins/admins.service';
import { LoginAdminDto } from 'src/admins/dto/login-admin.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { TAllUsers } from './types/all-users.type';
import { UpdateCompanyDto } from 'src/companies/dto/update-company.dto';
import { CompaniesService } from 'src/companies/companies.service';
import { CustomersService } from 'src/customers/customers.service';
import { LoginCompanyDto } from 'src/companies/dto/login-company.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AdminDto } from 'src/admins/dto/admin.dto';
import { CustomerDto } from 'src/customers/dto/customer.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly companiesService: CompaniesService,
    private readonly customersService: CustomersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateToken(token: string): Promise<TAllUsers | null> {
    return this.jwtService.verify(token);
  }

  async getTokensByPayload(payload: Record<string, any>) {
    console.log('🔧 Создание токенов с payload:', payload);
    
    const enhancedPayload = { ...payload, timestamp: Date.now() };
    console.log('🔧 Enhanced payload:', enhancedPayload);
    
    try {
      const accessToken = await this.jwtService.signAsync(enhancedPayload);
      const refreshToken = await this.jwtService.signAsync(enhancedPayload, { expiresIn: '7d' });
      
      console.log('✅ Токены созданы успешно');
      
      return {
        access: accessToken,
        refresh: refreshToken,
      };
    } catch (error) {
      console.log('❌ Ошибка при создании токенов:', error);
      throw error;
    }
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

  async validateCustomer(email: string, password: string, promotionId: string): Promise<CustomerDto> {
    const customer = await this.customersService.getCustomerByEmailAndPromotionId(email, promotionId);
    if (customer) {
      const isMatch = await bcrypt.compare(password, customer.password);
      if (isMatch) return customer;
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

  async loginCustomer(email: string, password: string, promotionId: string): Promise<LoginResponseDto> {
    const customer = await this.validateCustomer(email, password, promotionId);
    if (customer) {
      const payload = { 
        id: customer.id, 
        email: customer.email, 
        role: customer.role,
        promotionId: customer.promotionId,
        name: customer.name,
        surname: customer.surname
      };

      return this.getTokensByPayload(payload);
    } else {
      throw new UnauthorizedException();
    }
  }

  async unifiedLogin(emailOrUsername: string, password: string, promotionId?: string): Promise<LoginResponseDto> {
    let user: any = null;
    let role: string = '';

    try {
      user = await this.validateAdmin(emailOrUsername, password);
      if (user) {
        role = 'ADMIN';
        const payload = { id: user.id, username: user.username, role: user.role };
        return this.getTokensByPayload(payload);
      }
    } catch (error) {
      // Продолжаем попытку авторизации как клиент
    }

    try {
      user = await this.validateCompany(emailOrUsername, password);
      if (user) {
        role = 'COMPANY';
        const payload = { id: user.id, username: user.username, role: user.role, promotionId: user.promotionId };
        return this.getTokensByPayload(payload);
      }
    } catch (error) {
      // Продолжаем попытку авторизации как клиент
    }

    if (!promotionId) {
      throw new UnauthorizedException('Неверная почта/логин или пароль');
    }

    try {
      user = await this.validateCustomer(emailOrUsername, password, promotionId);
      if (user) {
        role = 'CUSTOMER';
        const payload = { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          promotionId: user.promotionId,
          name: user.name,
          surname: user.surname
        };
        return this.getTokensByPayload(payload);
      }
    } catch (error) {
      // Все попытки неудачны
    }

    throw new UnauthorizedException('Неверная почта/логин или пароль');
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
