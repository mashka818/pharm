import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@ApiTags('Product')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(AdminGuard)
  @ApiResponse({ type: UpdateProductDto })
  @ApiBody({ type: CreateProductDto })
  @Post()
  createProduct(@Body() createProductsDto: CreateProductDto) {
    return this.productsService.create(createProductsDto);
  }

  @ApiResponse({ type: [UpdateProductDto] })
  @Get()
  getAllProducts() {
    return this.productsService.getAll();
  }

  @ApiResponse({ type: UpdateProductDto })
  @Get(':id')
  getOneProduct(@Param('id') id: number) {
    return this.productsService.getOne(id);
  }

  @UseGuards(AdminGuard)
  @ApiResponse({ type: UpdateProductDto })
  @ApiBody({ type: UpdateProductDto })
  @Patch(':id')
  updateProduct(@Param('id') id: number, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  removeProduct(@Param('id') id: number) {
    return this.productsService.remove(id);
  }
}
