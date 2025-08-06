import { Body, Controller, Get, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { IRequestWithUser } from 'src/auth/types/all-users.type';
import { WithdrawalVariantsService } from 'src/withdrawal-variants/withdrawal-variants.service';
import { CreateWithdrawalVariantDto } from 'src/withdrawal-variants/dto/create-withdrawal-variant.dto';
import { UpdateCustomerDto } from './dto/update-customer-dto';
import { ApiBody, ApiResponse, ApiTags, OmitType, PickType } from '@nestjs/swagger';
import { CustomerDto } from './dto/customer.dto';
import { UpdateWithdrawalVariantDto } from 'src/withdrawal-variants/dto/update-withdrawal-variant.dto';
import { CustomersUpdateService } from './customers-update.service';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { confirmEmailDto, UpdateEmailDto } from './dto/update-email.dto';
import { LoginResponseDto } from 'src/auth/dto/login-response.dto';

@ApiTags('Customer')
@Controller('customers')
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customersUpdateService: CustomersUpdateService,
    private readonly withdrawalVariantsService: WithdrawalVariantsService,
  ) {}

  @ApiResponse({ type: CustomerDto })
  @Get('/me')
  getMe(@Request() req: IRequestWithUser) {
    const user = req.user;
    return this.customersService.getOne(user.id);
  }

  @ApiResponse({ type: [UpdateWithdrawalVariantDto] })
  @Get('/me/withdrawal-variants')
  getMyWithdrawalVariants(@Request() req: IRequestWithUser) {
    const user = req.user;
    return this.customersService.getCustomerWithdrawalVariants(user.id);
  }

  @ApiResponse({ type: UpdateWithdrawalVariantDto })
  @ApiBody({ type: CreateWithdrawalVariantDto })
  @Post('/me/withdrawal-variants')
  createMyWithdrawalVariant(
    @Request() req: IRequestWithUser,
    @Body() createWithdrawalVariantDto: CreateWithdrawalVariantDto,
  ) {
    const user = req.user;
    return this.withdrawalVariantsService.create(createWithdrawalVariantDto, user.id);
  }

  @ApiResponse({ type: CustomerDto })
  @ApiBody({ type: OmitType(UpdateCustomerDto, ['promotionId', 'password', 'email']) })
  @Patch('me')
  updateMe(@Request() req: IRequestWithUser, @Body() updateCustomerDto: UpdateCustomerDto) {
    const user = req.user;
    return this.customersUpdateService.updateOne(updateCustomerDto, user.id);
  }

  @ApiBody({ type: UpdatePasswordDto })
  @Patch('me/password')
  updateMyPassword(@Request() req: IRequestWithUser, @Body() updatePasswordDto: UpdatePasswordDto) {
    const user = req.user;
    return this.customersUpdateService.updatePassword(
      updatePasswordDto.prevPassword,
      updatePasswordDto.newPassword,
      user.id,
    );
  }

  @ApiBody({ type: UpdateEmailDto })
  @Post('me/email')
  updateMyEmail(@Request() req: IRequestWithUser, @Body() { email }: { email: string }) {
    const user = req.user;
    return this.customersUpdateService.updateEmail(email, user.id);
  }

  @ApiResponse({ type: LoginResponseDto })
  @ApiBody({ type: confirmEmailDto })
  @Post('me/email/confirm')
  confirmMyEmail(@Request() req: IRequestWithUser, @Body() { token }: { token: string }) {
    const user = req.user;
    return this.customersUpdateService.confirmEmail(token, user.id);
  }
}
