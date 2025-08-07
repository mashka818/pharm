import { Body, Controller, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginAdminDto } from 'src/admins/dto/login-admin.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { refreshDto } from './dto/refresh.dto';
import { LoginCompanyDto } from 'src/companies/dto/login-company.dto';
import { CreateCustomerDto } from 'src/customers/dto/create-customer.dto';
import { AuthCustomerService } from './auth-customer.service';
import { LoginCustomerDto } from 'src/customers/dto/login-customer.dto';
import { LoginCustomerDto as AuthLoginCustomerDto } from './dto/login-customer.dto';
import { Public } from 'src/decorators/public.decorator';
import { RegistrationResponseDto } from './dto/registration-response.dto';
import { ConfirmationResponseDto } from './dto/confirmation-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCustomerService: AuthCustomerService,
  ) {}

  @ApiResponse({ type: LoginResponseDto })
  @ApiBody({ type: LoginAdminDto })
  @Public()
  @Post('login/admin')
  loginAdmin(@Body() loginAdminDto: LoginAdminDto) {
    return this.authService.loginAdmin(loginAdminDto);
  }

  @ApiResponse({ type: LoginResponseDto })
  @ApiBody({ type: LoginCompanyDto })
  @Public()
  @Post('login/company')
  loginCompany(@Body() loginCompanyDto: LoginCompanyDto) {
    return this.authService.loginCompany(loginCompanyDto);
  }

  @ApiResponse({ type: LoginResponseDto })
  @ApiBody({ type: refreshDto })
  @Public()
  @Post('refresh/')
  refresh(@Body() refreshBody: { refresh: string }) {
    return this.authService.refresh(refreshBody.refresh);
  }

  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Пользователь успешно зарегистрирован',
    type: RegistrationResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Неверные данные или пользователь уже существует' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Промоакция не найдена' 
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Ошибка отправки email' 
  })
  @Public()
  @Post('reg')
  regCustomer(@Body() CreateCustomerDto: CreateCustomerDto) {
    return this.authCustomerService.regCustomer(CreateCustomerDto);
  }

  @ApiResponse({ 
    status: 200, 
    description: 'Пользователь успешно подтвержден',
    type: ConfirmationResponseDto 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Пользователь не найден' 
  })
  @Public()
  @Post('confirm/:confirmationToken')
  confirm(@Param('confirmationToken') confirmationToken: string) {
    return this.authCustomerService.confirmCustomer(confirmationToken);
  }

  @ApiResponse({ type: LoginResponseDto })
  @ApiBody({ type: LoginCustomerDto })
  @Public()
  @Post('login/customer')
  loginCustomer(@Body() loginCustomerDto: LoginCustomerDto) {
    return this.authCustomerService.loginCustomer(loginCustomerDto);
  }

  @ApiResponse({ type: LoginResponseDto })
  @ApiBody({ type: AuthLoginCustomerDto })
  @Public()
  @Post('login/customer-v2')
  loginCustomerV2(@Body() loginCustomerDto: AuthLoginCustomerDto) {
    return this.authService.loginCustomer(
      loginCustomerDto.email, 
      loginCustomerDto.password, 
      loginCustomerDto.promotionId
    );
  }
}
