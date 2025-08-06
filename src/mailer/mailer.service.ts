import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IMailOptions } from './types/mail-options.type';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 465,
      secure: true,
      auth: {
        user: process.env.YANDEX_ADDRESS,
        pass: process.env.YANDEX_PASS,
      },
    });
  }

  async sendMail(mailOptions: IMailOptions) {
    this.transporter.verify(function (error) {
      if (error) {
        console.log(error);
      } else {
        console.log('Server is ready to take our messages');
      }
    });

    try {
      await this.transporter.sendMail({
        ...mailOptions,
        from: process.env.YANDEX_ADDRESS,
      });
      return { isSuccess: true };
    } catch (error) {
      return { isError: true };
    }
  }
}
