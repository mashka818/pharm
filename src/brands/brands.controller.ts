import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { CreateBrandDto } from './dto/create-brand.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';

@UseGuards(AdminGuard)
@ApiTags('Brand')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @ApiResponse({ type: UpdateBrandDto })
  @ApiBody({ type: CreateBrandDto })
  @Post()
  @UseInterceptors(FileInterceptor('logo'))
  createBrand(@Body() createBrandDto: CreateBrandDto, @UploadedFile() logo: Express.Multer.File) {
    return this.brandsService.create(createBrandDto, logo);
  }

  @ApiResponse({ type: [UpdateBrandDto] })
  @Get()
  getAllBrands() {
    return this.brandsService.getAll();
  }

  @ApiResponse({ type: UpdateBrandDto })
  @Get(':id')
  getOneBrand(@Param('id') id: number) {
    return this.brandsService.getOne(id);
  }

  @ApiResponse({ type: UpdateBrandDto })
  @ApiBody({ type: UpdateBrandDto })
  @Patch(':id')
  @UseInterceptors(FileInterceptor('logo'))
  updateBrand(
    @Param('id') id: number,
    @Body() updateBrandDto: UpdateBrandDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    return this.brandsService.update(id, updateBrandDto, logo);
  }

  @Delete(':id')
  removeBrand(@Param('id') id: number) {
    return this.brandsService.remove(id);
  }
}
