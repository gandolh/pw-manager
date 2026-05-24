import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/api.js';

const TIMEOUT_MS = 10 * 60 * 1000;

export class Session {
  private key: Buffer | null = null;
  private lastActivity = 0;

  constructor(private getWindow: () => BrowserWindow | null) {}

  isLocked(): boolean {
    if (!this.key) return true;
    if (Date.now() - this.lastActivity >= TIMEOUT_MS) {
      this.key = null;
      this.getWindow()?.webContents.send(IPC.lockedEvent);
      return true;
    }
    return false;
  }

  touch(): void {
    this.lastActivity = Date.now();
  }

  unlock(key: Buffer): void {
    this.key = key;
    this.touch();
  }

  lock(): void {
    this.key = null;
  }

  requireKey(): Buffer {
    if (this.isLocked()) throw new Error('LOCKED');
    this.touch();
    return this.key!;
  }
}
