import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import * as sharp from 'sharp';

@Injectable()
export class FilesService {
  deleteFile(fileName: string): void {
    const filePath = path.resolve(__dirname, '..', 'static', fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async createFile(file: Express.Multer.File): Promise<string> {
    try {
      const fileExtension = path.extname(file.originalname);

      const filePath = path.resolve(__dirname, '..', 'static');

      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true });
      }
      let fileName: string;

      if (file.mimetype.startsWith('image/')) {
        fileName = `${uuidv4()}.webp`;
        let image = sharp(file.buffer);

        const metadata = await image.metadata();
        if (metadata.width && metadata.height) {
          const newWidth = Math.floor(metadata.width * 0.6);
          const newHeight = Math.floor(metadata.height * 0.6);
          image = image.resize(newWidth, newHeight);
        }
        const webpBuffer = await image.toFormat('webp').toBuffer();

        fs.writeFileSync(path.join(filePath, fileName), webpBuffer);
      } else {
        fileName = `${uuidv4()}${fileExtension}`;
        fs.writeFileSync(path.join(filePath, fileName), file.buffer);
      }

      return fileName;
    } catch (error) {
      throw new HttpException('Error of uploading file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
