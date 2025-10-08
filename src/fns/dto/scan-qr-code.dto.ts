import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ScanQrCodeDto {
  @ApiProperty({ 
    description: 'Фискальный номер (ФН)', 
    example: '9287440300090728',
    minLength: 16,
    maxLength: 16
  })
  @IsString()
  @IsNotEmpty()
  fn: string;

  @ApiProperty({ 
    description: 'Фискальный документ (ФД)', 
    example: '77133' 
  })
  @IsString()
  @IsNotEmpty()
  fd: string;

  @ApiProperty({ 
    description: 'Фискальный признак (ФП)', 
    example: '1482926127' 
  })
  @IsString()
  @IsNotEmpty()
  fp: string;

  @ApiProperty({ 
    description: 'Сумма чека в рублях (будет конвертирована в копейки автоматически)', 
    example: 1200,
    minimum: 0.01
  })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  sum: number;

  @ApiProperty({ 
    description: 'Дата и время операции в московском времени. Поддерживаемые форматы: ISO 8601, DD.MM.YYYY HH:mm, YYYY-MM-DD HH:mm:ss', 
    example: '06.10.2025 10:14' 
  })
  @Transform(({ value }) => {
    if (!value) return value;
    
    // Если уже в правильном ISO формате с часовым поясом
    if (value.includes('+') || value.includes('Z')) {
      return value;
    }
    
    // Если в формате DD.MM.YYYY HH:mm (из QR кода)
    if (value.match(/^\d{1,2}\.\d{1,2}\.\d{4} \d{1,2}:\d{2}$/)) {
      const [datePart, timePart] = value.split(' ');
      const [day, month, year] = datePart.split('.');
      const [hours, minutes] = timePart.split(':');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes}:00+03:00`;
    }
    
    // Если в формате DD.MM.YYYY HH:mm:ss (из QR кода)
    if (value.match(/^\d{1,2}\.\d{1,2}\.\d{4} \d{1,2}:\d{2}:\d{2}$/)) {
      const [datePart, timePart] = value.split(' ');
      const [day, month, year] = datePart.split('.');
      const [hours, minutes, seconds] = timePart.split(':');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes}:${seconds}+03:00`;
    }
    
    // Если в формате YYYY-MM-DD HH:mm:ss (московское время)
    if (value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      return value.replace(' ', 'T') + '+03:00';
    }
    
    // Если в формате YYYY-MM-DDTHH:mm:ss (без часового пояса)
    if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
      return value + '+03:00';
    }
    
    // Если дата повреждена (как в примере "06.1-0.-20T5 :10::1"), пытаемся исправить
    if (value.includes('.') && value.includes('T')) {
      try {
        // Убираем лишние символы и пытаемся восстановить
        const cleaned = value.replace(/[^\d\.T:]/g, '');
        const parts = cleaned.split('T');
        if (parts.length === 2) {
          const [datePart, timePart] = parts;
          const dateMatch = datePart.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
          const timeMatch = timePart.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/);
          
          if (dateMatch && timeMatch) {
            const [, day, month, year] = dateMatch;
            const [, hours, minutes, seconds] = timeMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}+03:00`;
          }
        }
      } catch (error) {
        // Если не удалось исправить, возвращаем как есть
      }
    }
    
    // Специальная обработка для очень поврежденных дат типа "06.1-0.-20T5 :10::1"
    if (value.includes('.') && value.includes('T') && value.includes(':')) {
      try {
        // Извлекаем все цифры из строки
        const digits = value.replace(/[^\d]/g, '');
        
        // Если у нас есть достаточно цифр для даты и времени
        if (digits.length >= 10) {
          // Пытаемся восстановить дату и время из цифр
          // Формат: DDMMYYYYHHMM или DDMMYYYYHHMMSS
          const day = digits.substring(0, 2);
          const month = digits.substring(2, 4);
          const year = digits.substring(4, 8);
          const hours = digits.substring(8, 10);
          const minutes = digits.substring(10, 12);
          const seconds = digits.length >= 14 ? digits.substring(12, 14) : '00';
          
          // Проверяем валидность
          if (parseInt(day) >= 1 && parseInt(day) <= 31 &&
              parseInt(month) >= 1 && parseInt(month) <= 12 &&
              parseInt(year) >= 2000 && parseInt(year) <= 2100 &&
              parseInt(hours) >= 0 && parseInt(hours) <= 23 &&
              parseInt(minutes) >= 0 && parseInt(minutes) <= 59) {
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`;
          }
        }
      } catch (error) {
        // Если не удалось исправить, возвращаем как есть
      }
    }
    
    return value;
  })
  @IsDateString()
  date: string;

  @ApiProperty({ 
    description: 'Тип операции (1 - приход, 2 - возврат прихода)', 
    example: 1,
    enum: [1, 2],
    required: false,
    default: 1
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  typeOperation?: number;

  @ApiProperty({ 
    description: 'Дополнительные параметры QR-кода', 
    required: false 
  })
  @IsOptional()
  additionalData?: Record<string, any>;
}