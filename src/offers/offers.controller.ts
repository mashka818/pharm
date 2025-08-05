import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResponseOfferDto, ResponseOfferDtoWithProducts } from './dto/response-offer.dto';
import { GetOneOfferService } from './get-one-offer.service';
import { CreateOfferService } from './create-offer.service';
import { UpdateOfferService } from './update-offer.service';

@ApiTags('Offer')
@Controller('offers')
export class OffersController {
  constructor(
    private readonly offersService: OffersService,
    private readonly getOneOfferService: GetOneOfferService,
    private readonly createOfferService: CreateOfferService,
    private readonly updateOfferService: UpdateOfferService,
  ) {}

  @ApiResponse({ type: ResponseOfferDto })
  @ApiBody({ type: CreateOfferDto })
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('banner_image'))
  @Post()
  createOffer(
    @Body() createOfferDto: CreateOfferDto,
    @UploadedFile() banner_image?: Express.Multer.File,
  ) {
    return this.createOfferService.create(createOfferDto, banner_image);
  }

  @ApiResponse({ type: ResponseOfferDtoWithProducts })
  @Get(':id')
  getOneOffer(@Param('id') id: number) {
    return this.getOneOfferService.getOne(id);
  }

  @ApiResponse({ type: [ResponseOfferDto] })
  @Get()
  getAllOffers() {
    return this.offersService.getAll();
  }

  @ApiResponse({ type: ResponseOfferDtoWithProducts })
  @ApiBody({ type: UpdateOfferDto })
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('banner_image'))
  @Patch(':id')
  updateOffer(
    @Param('id') id: number,
    @Body() updateOfferDto: UpdateOfferDto,
    @UploadedFile() banner_image?: Express.Multer.File,
  ) {
    return this.updateOfferService.update(id, updateOfferDto, banner_image);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  removeOffer(@Param('id') id: number) {
    return this.offersService.remove(id);
  }
}
