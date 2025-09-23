import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IMailOptions } from './types/mail-options.type';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailerService.name);
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 587,
      secure: false, // STARTTLS
      auth: {
        user: process.env.YANDEX_ADDRESS,
        pass: process.env.YANDEX_PASS,
      },
      tls: {
        rejectUnauthorized: true,
        servername: 'smtp.yandex.ru',
      },
      logger: true,
      debug: true,
    });
  }

  async sendMail(mailOptions: IMailOptions) {
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error(`SMTP verify failed: ${error?.message || error}`);
      } else {
        this.logger.log('SMTP server is ready to take messages (verify ok)');
      }
    });

    try {
      const info = await this.transporter.sendMail({
        ...mailOptions,
        from: `Pharm Vision <${process.env.YANDEX_ADDRESS}>`,
        sender: process.env.YANDEX_ADDRESS,
      });
      this.logger.log(`Mail sent: accepted=${(info.accepted||[]).join(',')}, rejected=${(info.rejected||[]).join(',')}, response=${info.response}`);
      return { isSuccess: true };
    } catch (error) {
      this.logger.error(`sendMail error: ${error?.message || error}`);
      // Fallback to implicit TLS 465 if STARTTLS path fails (some providers)
      try {
        const alt = nodemailer.createTransport({
          host: 'smtp.yandex.ru',
          port: 465,
          secure: true,
          auth: {
            user: process.env.YANDEX_ADDRESS,
            pass: process.env.YANDEX_PASS,
          },
          tls: { rejectUnauthorized: true, servername: 'smtp.yandex.ru' },
          logger: true,
          debug: true,
        });
        const info2 = await alt.sendMail({
          ...mailOptions,
          from: `Pharm Vision <${process.env.YANDEX_ADDRESS}>`,
          sender: process.env.YANDEX_ADDRESS,
        });
        this.logger.log(`Mail sent via 465 fallback: accepted=${(info2.accepted||[]).join(',')}, rejected=${(info2.rejected||[]).join(',')}, response=${info2.response}`);
        return { isSuccess: true };
      } catch (error2) {
        this.logger.error(`fallback sendMail error: ${error2?.message || error2}`);
        return { isError: true };
      }
    }
  }
}
