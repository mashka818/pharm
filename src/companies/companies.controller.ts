import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Company')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @ApiResponse({ type: UpdateCompanyDto })
  @ApiBody({ type: CreateCompanyDto })
  @Post()
  createCompany(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @ApiResponse({ type: [UpdateCompanyDto] })
  @Get()
  getAllCompanies() {
    return this.companiesService.getAll();
  }

  @ApiResponse({ type: UpdateCompanyDto })
  @Get(':id')
  getOneCompany(@Param('id') id: string) {
    return this.companiesService.getOne(+id);
  }

  @ApiResponse({ type: UpdateCompanyDto })
  @ApiBody({ type: UpdateCompanyDto })
  @Put(':id')
  updateCompany(@Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(updateCompanyDto);
  }

  @Delete(':id')
  removeCompany(@Param('id') id: string) {
    return this.companiesService.remove(+id);
  }
}
