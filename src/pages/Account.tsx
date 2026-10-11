import { useState } from "react"
import { Download, ShieldAlert, UserX } from "lucide-react"
import { api } from "@/lib/api"
import { useSession } from "@/lib/session"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const CONFIRM = "ERASE MY ACCOUNT"

// Privacy self-service for any signed-in local account: export own data, or pseudonymise the account.
export function AccountPage() {
  const { user, login, logout } = useSession()
  const [username, setUsername] = useState("")
  const [signInPassword, setSignInPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [erased, setErased] = useState<string | null>(null)

  const exportData = async () => {
    setError("")
    try {
      const data = await api.accountExport()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
      const link = Object.assign(document.createElement("a"), { href: url, download: "medforge-account-export.json" })
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e instanceof Error ? e.message : "The export failed") }
  }
  const erase = async () => {
    setBusy(true); setError("")
    try {
      const result = await api.accountErase(password)
      setErased(result.learner_code)
      setPassword(""); setConfirm("")
      await logout()
    } catch (e) { setError(e instanceof Error ? e.message : "The account could not be erased") }
    finally { setBusy(false) }
  }

  if (erased) return <Alert className="max-w-2xl"><UserX /><AlertTitle>Account erased</AlertTitle><AlertDescription>Your name, sign-in and roles were removed. Learning records and audit entries remain under the pseudonymous code {erased}, so the audit chain stays verifiable.</AlertDescription></Alert>
  if (!user) return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle role="heading" aria-level={2} className="flex items-center gap-2"><ShieldAlert aria-hidden />Sign in to manage your data</CardTitle><CardDescription>Data export and account erasure are available to any signed-in local account.</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={async event => { event.preventDefault(); setError(""); try { await login(username, signInPassword); setSignInPassword("") } catch (e) { setError(e instanceof Error ? e.message : "Sign in failed") } }}>
          <Field className="grid gap-1"><FieldLabel htmlFor="account-username">Username</FieldLabel><Input id="account-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required /></Field>
          <Field className="grid gap-1"><FieldLabel htmlFor="account-password">Password</FieldLabel><Input id="account-password" type="password" autoComplete="current-password" value={signInPassword} onChange={event => setSignInPassword(event.target.value)} required /></Field>
          <Button type="submit" className="w-fit">Sign in</Button>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </form>
      </CardContent>
    </Card>
  )

  return (
    <div className="grid max-w-2xl gap-4">
      <Card>
        <CardHeader>
          <CardDescription>Signed in as {user.display_name} · {user.role.replace("_", " ")}</CardDescription>
          <CardTitle role="heading" aria-level={2}>Your data</CardTitle>
          <CardDescription>Download what MEDFORGE stores about this account: profile, roles, session counts, attempts, answers and the audit entries you performed. Passwords and session tokens are never included.</CardDescription>
        </CardHeader>
        <CardContent><Button type="button" variant="outline" onClick={() => void exportData()}><Download data-icon="inline-start" />Download my data</Button></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Erase this account</CardTitle>
          <CardDescription>Removes your name, sign-in credentials, sessions and roles. Learning records and audit entries are kept under a pseudonymous code so the audit chain stays intact. This cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field className="grid gap-1"><FieldLabel htmlFor="erase-password">Current password</FieldLabel><Input id="erase-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></Field>
          <Field className="grid gap-1"><FieldLabel htmlFor="erase-confirm">Type {CONFIRM} to confirm</FieldLabel><Input id="erase-confirm" value={confirm} onChange={event => setConfirm(event.target.value)} /></Field>
          <Button type="button" variant="destructive" className="w-fit" disabled={busy || !password || confirm !== CONFIRM} onClick={() => void erase()}>{busy ? "Erasing..." : "Erase my account"}</Button>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </CardContent>
      </Card>
    </div>
  )
}
