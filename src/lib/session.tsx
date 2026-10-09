import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { LockKeyhole, LogOut } from 'lucide-react'
import { api, setApiSessionToken } from './api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

type Role='student'|'educator'|'researcher'|'admin'
type User={id:string;display_name:string;role:Role}
type SessionContextValue={user:User|null;login:(username:string,password:string)=>Promise<void>;logout:()=>Promise<void>}
const SessionContext=createContext<SessionContextValue|null>(null)

export function SessionProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null)
  const login=async(username:string,password:string)=>{
    const session=await api.localLogin(username,password)
    setApiSessionToken(session.access_token)
    setUser(session.user)
  }
  const logout=async()=>{
    try{await api.localLogout()}finally{setApiSessionToken(null);setUser(null)}
  }
  const value=useMemo(()=>({user,login,logout}),[user])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(){
  const value=useContext(SessionContext)
  if(!value)throw new Error('useSession must be used inside SessionProvider')
  return value
}

export function LearningRoleGate({role,children}:{role:'student'|'educator';children:ReactNode}){
  const {user,login,logout}=useSession()
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  if(user&&user.role!==role)return <Card className="role-gate-card"><CardHeader><div className="eyebrow">Local learning session</div><CardTitle>This area is for {role}s</CardTitle><CardDescription>Signed in as {user.display_name} · {user.role}. Sign out before using the other role.</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={()=>void logout()}><LogOut data-icon="inline-start"/>Sign out</Button></CardContent></Card>
  if(!user)return <div className="role-gate"><Card className="role-gate-card"><CardHeader><div className="role-gate-mark"><LockKeyhole/></div><div className="eyebrow">Protected local workspace</div><CardTitle>{role==='educator'?'Educator sign in':'Student sign in'}</CardTitle><CardDescription>Use an account provisioned on this computer. Learning answers and rubrics are checked by the local API.</CardDescription></CardHeader><CardContent><form className="role-gate-form" onSubmit={async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setBusy(true);setError('');try{await login(username,password)}catch(e){setError(e instanceof Error?e.message:'Sign in failed')}finally{setBusy(false)}}}><FieldGroup><Field><FieldLabel htmlFor={`${role}-username`}>Username</FieldLabel><Input id={`${role}-username`} autoComplete="username" value={username} onChange={event=>setUsername(event.target.value)} required/></Field><Field><FieldLabel htmlFor={`${role}-password`}>Password</FieldLabel><Input id={`${role}-password`} type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/></Field>{error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}<Button type="submit" disabled={busy}>{busy?'Signing in…':`Sign in as ${role}`}</Button></FieldGroup></form><p className="role-gate-help">Accounts are created locally by the workspace operator. Passwords are stored as salted PBKDF2 hashes; session tokens expire after eight hours and stay in memory in this browser tab.</p></CardContent></Card></div>
  return <>{children}</>
}
