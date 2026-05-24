import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type Api } from '../shared/api.js';
import type { CredentialInput, CopyField } from '../shared/types.js';

const api: Api = {
  vaultExists: () => ipcRenderer.invoke(IPC.exists),
  isLocked: () => ipcRenderer.invoke(IPC.isLocked),
  setup: (pw: string) => ipcRenderer.invoke(IPC.setup, pw),
  unlock: (pw: string) => ipcRenderer.invoke(IPC.unlock, pw),
  lock: () => ipcRenderer.invoke(IPC.lock),
  list: () => ipcRenderer.invoke(IPC.list),
  add: (input: CredentialInput) => ipcRenderer.invoke(IPC.add, input),
  see: (id: number) => ipcRenderer.invoke(IPC.see, id),
  edit: (id: number, input: CredentialInput) => ipcRenderer.invoke(IPC.edit, id, input),
  remove: (id: number) => ipcRenderer.invoke(IPC.remove, id),
  copy: (id: number, field: CopyField) => ipcRenderer.invoke(IPC.copy, id, field),
  onLocked: (cb: () => void) => {
    ipcRenderer.on(IPC.lockedEvent, cb);
  },
};

contextBridge.exposeInMainWorld('api', api);
