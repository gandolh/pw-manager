export interface Credential {
  id: number;
  name: string;
  username: string;
  password: string;
}

export interface Meta {
  salt: string;
  verification: string;
}

export interface CredentialInput {
  name: string;
  username: string;
  password: string;
}

export type CredentialSummary = Omit<Credential, 'password'>;

export type CopyField = 'password' | 'username';

export interface VaultResult {
  ok: boolean;
  error?: string;
}
