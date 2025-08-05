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

  @ApiProperty({
    description: 'Domain for multi-tenancy',
    example: 'x-farm.checkpoint.rf',
    required: true,
  })
  @IsString()
  domain: string;

  @ApiProperty({
    description: 'INN of the pharmacy network',
    example: '5032364514',
    required: false,
  })
  @IsOptional()
  @IsString()
  inn?: string;

  @ApiProperty({
    description: 'OGRN of the pharmacy network',
    example: '1234567890123',
    required: false,
  })
  @IsOptional()
  @IsString()
  ogrn?: string;

  @ApiProperty({
    description: 'FNS App ID',
    example: '2dbfa911-1931-48e7-802f-640dc64429b0',
    required: false,
  })
  @IsOptional()
  @IsString()
  appId?: string;
}
