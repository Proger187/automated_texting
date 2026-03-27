import Store from 'electron-store'
import type { Account } from '../types/accounts'
import type { CredentialType } from '../types/ipc'

interface AccountsSchema {
  accounts: Account[]
}

const accountsStore = new Store<AccountsSchema>({
  name: 'accounts',
  defaults: { accounts: [] },
})

export function listAccounts(): Account[] {
  return accountsStore.get('accounts')
}

export function listAccountsByType(type: CredentialType): Account[] {
  return accountsStore.get('accounts').filter((a) => a.type === type)
}

export function saveAccount(account: Account): void {
  const all = accountsStore.get('accounts')
  const idx = all.findIndex((a) => a.id === account.id)
  if (idx >= 0) {
    all[idx] = account
  } else {
    all.push(account)
  }
  accountsStore.set('accounts', all)
}

export function deleteAccount(id: string): void {
  const all = accountsStore.get('accounts').filter((a) => a.id !== id)
  accountsStore.set('accounts', all)
}

export function getAccount(id: string): Account | undefined {
  return accountsStore.get('accounts').find((a) => a.id === id)
}
