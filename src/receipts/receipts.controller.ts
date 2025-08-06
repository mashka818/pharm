import { Controller, Get, Post, Body, Param, Delete, Put } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post()
  create(@Body() createReceiptDto: CreateReceiptDto) {
    return this.receiptsService.create(createReceiptDto);
  }

  @Get()
  findAll() {
    return this.receiptsService.getAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receiptsService.getOne(+id);
  }

  @Put(':id')
  update(@Body() updateReceiptDto: UpdateReceiptDto) {
    return this.receiptsService.update(updateReceiptDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.receiptsService.remove(+id);
  }
}
