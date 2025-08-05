import { Controller, Delete, Param, Request } from '@nestjs/common';
import { WithdrawalVariantsService } from './withdrawal-variants.service';
import { IRequestWithUser } from 'src/auth/types/all-users.type';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Withdrawal variants')
@Controller('withdrawal-variants')
export class WithdrawalVariantsController {
  constructor(private readonly withdrawalVariantsService: WithdrawalVariantsService) {}

  @Delete(':id')
  removeWithdrawalVariant(@Param('id') id: number, @Request() req: IRequestWithUser) {
    const user = req.user;
    return this.withdrawalVariantsService.remove(id, user.id);
  }
}
