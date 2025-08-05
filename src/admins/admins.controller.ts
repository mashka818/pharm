import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminsService } from './admins.service';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { LoginAdminDto } from './dto/login-admin.dto';
import { UserOwnershipGuard } from 'src/auth/guards/user-ownership.guard';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateAdminDto } from './dto/update-admin.dto';

@UseGuards(AdminGuard)
@ApiTags('Admin')
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  getAdminByUsername(username: LoginAdminDto['username']) {
    return this.adminsService.getAdminByUsername(username);
  }

  @ApiResponse({ type: UpdateAdminDto })
  @ApiBody({ type: LoginAdminDto })
  @Post()
  createAdmin(@Body() adminDto: LoginAdminDto) {
    return this.adminsService.create(adminDto);
  }

  @ApiResponse({ type: UpdateAdminDto })
  @Get(':id')
  getOneAdmin(@Param('id') id: number) {
    return this.adminsService.getOne(+id);
  }

  @ApiResponse({ type: [UpdateAdminDto] })
  @Get()
  getAllAdmins() {
    return this.adminsService.getAll();
  }

  @ApiResponse({ type: UpdateAdminDto })
  @ApiBody({ type: UpdateAdminDto })
  @UseGuards(UserOwnershipGuard)
  @Put(':id')
  updateAdmin(@Body() updateAdminDto: UpdateAdminDto) {
    return this.adminsService.update(updateAdminDto);
  }

  @Delete(':id')
  removeAdmin(@Param('id') id: number) {
    return this.adminsService.remove(+id);
  }
}
