import { ApiProperty } from '@nestjs/swagger';

export class InnValidationDto {
  @ApiProperty({ description: 'ИНН из чека' })
  receiptInn: string;

  @ApiProperty({ description: 'Ожидаемый ИНН организации' })
  expectedInn: string;

  @ApiProperty({ description: 'Результат валидации' })
  isValid: boolean;

  @ApiProperty({ description: 'Причина отклонения', required: false })
  rejectionReason?: string;
}

export class ReceiptValidationResult {
  @ApiProperty({ description: 'Результат проверки ИНН' })
  innValidation: InnValidationDto;

  @ApiProperty({ description: 'Чек принят для обработки' })
  accepted: boolean;

  @ApiProperty({ description: 'Сообщение для пользователя' })
  message: string;
}
