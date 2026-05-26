export interface SavedAccount {
  email: string
  name: string | null
  avatar_url: string | null
}

const KEY = 'drivn_saved_accounts'

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveAccount(account: SavedAccount): void {
  const accounts = getSavedAccounts()
  const idx = accounts.findIndex((a) => a.email === account.email)
  if (idx >= 0) {
    accounts[idx] = account
  } else {
    accounts.push(account)
  }
  localStorage.setItem(KEY, JSON.stringify(accounts))
}

export function removeAccount(email: string): void {
  const accounts = getSavedAccounts().filter((a) => a.email !== email)
  localStorage.setItem(KEY, JSON.stringify(accounts))
}
