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
