// Minimal type shim for whatsapp-web.js (no official @types package)
declare module 'whatsapp-web.js' {
  import { EventEmitter } from 'events'

  export interface ClientOptions {
    authStrategy?: BaseAuthStrategy
    puppeteer?: Record<string, unknown>
  }

  export interface Message {
    body: string
  }

  export class BaseAuthStrategy {}

  export class NoAuth extends BaseAuthStrategy {}

  export class LocalAuth extends BaseAuthStrategy {
    constructor(opts?: { clientId?: string; dataPath?: string })
  }

  export class Client extends EventEmitter {
    constructor(options?: ClientOptions)
    initialize(): Promise<void>
    destroy(): Promise<void>
    sendMessage(chatId: string, content: string): Promise<Message>
    pupPage?: unknown
  }
}
