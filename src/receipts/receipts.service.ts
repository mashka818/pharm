import { Injectable } from '@nestjs/common';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';

@Injectable()
export class ReceiptsService {
  create(createReceiptDto: CreateReceiptDto) {
    return 'This action adds a new receipt';
  }

  getAll() {
    return `This action returns all receipts`;
  }

  getOne(id: number) {
    return `This action returns a #${id} receipt`;
  }

  update(updateReceiptDto: UpdateReceiptDto) {
    return `This action updates a #${updateReceiptDto} receipt`;
  }

  remove(id: number) {
    return `This action removes a #${id} receipt`;
  }
}
