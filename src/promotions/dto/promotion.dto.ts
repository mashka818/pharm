import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PromotionDto {
  @ApiProperty({
    description: 'Уникальный код промоакции',
    example: 'x-pharm',
    required: true,
  })
  @IsString()
  promotionId: string;

  @ApiProperty({
    description: 'Название промоакции',
    example: 'Икс-Фарм',
    required: true,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Логотип (файл или имя файла)',
    example: 'logo.png',
    required: true,
  })
  logo: string;

  @ApiProperty({
    description: 'Баннер (файл или имя файла)',
    example: 'banner.png',
    required: false,
  })
  @IsOptional()
  banner?: string;

  @ApiProperty({
    description: 'Favicon (файл или имя файла)',
    example: 'favicon.ico',
    required: false,
  })
  favicon: string;

  @ApiProperty({
    description: 'Описание промоакции',
    example: 'Описание акции',
    required: true,
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Цвет оформления',
    example: 'green',
    required: true,
  })
  @IsString()
  color: string;

  @ApiProperty({
    description: 'Домен для мультиарендности',
    example: 'x-farm.checkpoint.rf',
    required: true,
  })
  @IsString()
  domain: string;

  @ApiProperty({
    description: 'ИНН аптечной сети',
    example: '5032364514',
    required: false,
  })
  @IsOptional()
  @IsString()
  inn?: string;

  @ApiProperty({
    description: 'ОГРН аптечной сети',
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
