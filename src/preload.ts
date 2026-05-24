import { contextBridge, ipcRenderer } from 'electron';

export interface CredentialInput {
  name: string;
  username: string;
  password: string;
}

const api = {
  vaultExists: (): Promise<boolean> => ipcRenderer.invoke('vault:exists'),
  isLocked: (): Promise<boolean> => ipcRenderer.invoke('vault:is-locked'),
  setup: (pw: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('vault:setup', pw),
  unlock: (pw: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('vault:unlock', pw),
  lock: (): Promise<void> => ipcRenderer.invoke('vault:lock'),
  list: (): Promise<{ id: number; name: string; username: string }[]> => ipcRenderer.invoke('vault:list'),
  add: (input: CredentialInput): Promise<number> => ipcRenderer.invoke('vault:add', input),
  see: (id: number): Promise<{ id: number; name: string; username: string; password: string } | null> =>
    ipcRenderer.invoke('vault:see', id),
  edit: (id: number, input: CredentialInput): Promise<boolean> => ipcRenderer.invoke('vault:edit', id, input),
  remove: (id: number): Promise<boolean> => ipcRenderer.invoke('vault:remove', id),
  copy: (id: number, field: 'password' | 'username'): Promise<boolean> =>
    ipcRenderer.invoke('vault:copy', id, field),
  onLocked: (cb: () => void): void => {
    ipcRenderer.on('vault:locked', cb);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
