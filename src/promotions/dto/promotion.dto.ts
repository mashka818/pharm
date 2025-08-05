import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PromotionDto {
  @ApiProperty({
    description: 'Custom unique code of promotion',
    example: 'x-pharm',
    required: true,
  })
  @IsString()
  promotionId: string;

  @ApiProperty({
    description: 'Name of promotion',
    example: 'Икс-Фарм',
    required: true,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Logo file or FileName',
    example: 'File with Image TO UPDATE/CREATE IMAGE or FileName',
    required: true,
  })
  logo: string;

  @ApiProperty({
    description: 'Banner file or FileName',
    example: 'File with Image TO UPDATE/CREATE IMAGE or FileName',
    required: false,
  })
  @IsOptional()
  banner?: string;

  @ApiProperty({
    description: 'Favicon file or FileName',
    example: 'File with Image TO UPDATE/CREATE IMAGE or FileName',
    required: false,
  })
  favicon: string;

  @ApiProperty({
    description: 'Description of promotion',
    example: 'some description',
    required: true,
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Color',
    example: 'green',
    required: true,
  })
  @IsString()
  color: string;
}
