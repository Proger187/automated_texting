import nodemailer from 'nodemailer'
import type { IMessagingAdapter, SendResult, EmailCredentials } from './types'

export class EmailAdapter implements IMessagingAdapter {
  async send(
    contact: string,
    message: string,
    credentials: unknown,
    subject?: string,
  ): Promise<SendResult> {
    const creds = credentials as EmailCredentials

    if (!creds?.host || !creds?.user || !creds?.pass) {
      return { success: false, error: 'Email credentials not configured' }
    }

    // Use provided subject, or fall back to first non-empty line of the message
    const resolvedSubject = subject?.trim()
      || message.split('\n').find((l) => l.trim().length > 0)
      || '(no subject)'

    try {
      const transporter = nodemailer.createTransport({
        host: creds.host,
        port: creds.port ?? 587,
        secure: (creds.port ?? 587) === 465,
        auth: {
          user: creds.user,
          pass: creds.pass,
        },
      })

      await transporter.sendMail({
        from: creds.from || creds.user,
        to: contact,
        subject: resolvedSubject,
        text: message,
      })

      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }
}

export const emailAdapter = new EmailAdapter()
