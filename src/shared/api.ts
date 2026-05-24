import type { Credential, CredentialInput, CredentialSummary, CopyField, VaultResult } from './types.js';

export interface Api {
  vaultExists(): Promise<boolean>;
  isLocked(): Promise<boolean>;
  setup(pw: string): Promise<VaultResult>;
  unlock(pw: string): Promise<VaultResult>;
  lock(): Promise<void>;
  list(): Promise<CredentialSummary[]>;
  add(input: CredentialInput): Promise<number>;
  see(id: number): Promise<Credential | null>;
  edit(id: number, input: CredentialInput): Promise<boolean>;
  remove(id: number): Promise<boolean>;
  copy(id: number, field: CopyField): Promise<boolean>;
  onLocked(cb: () => void): void;
}

export const IPC = {
  exists: 'vault:exists',
  isLocked: 'vault:is-locked',
  setup: 'vault:setup',
  unlock: 'vault:unlock',
  lock: 'vault:lock',
  list: 'vault:list',
  add: 'vault:add',
  see: 'vault:see',
  edit: 'vault:edit',
  remove: 'vault:remove',
  copy: 'vault:copy',
  lockedEvent: 'vault:locked',
} as const;
