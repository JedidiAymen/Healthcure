import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { OfflineBanner } from '@/components/OfflineBanner'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AudioLines, BookOpenCheck, Boxes, ClipboardCheck, FileText, FlaskConical, GraduationCap, Layers3, Microscope, Radio, ScanLine, Search, ShieldCheck, Stethoscope, Trophy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type CaseRecord } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarSeparator, SidebarTrigger,
} from '@/components/ui/sidebar'

const navigation = [
  { label: 'Research workbench', to: '/studio', icon: Layers3, end: true },
  { label: 'Case registry', to: '/studio/cases', icon: Boxes },
  { label: 'Model lab', to: '/studio/models', icon: Microscope },
  { label: 'Experiments', to: '/studio/experiments', icon: FlaskConical },
  { label: 'Evidence reports', to: '/studio/reports', icon: FileText },
]
const specialties = [
  { label: 'SurgiVision', audience: 'Surgical teams', module: 'surgivision', to: '/studio/surgivision/cases/current', icon: ScanLine },
  { label: 'DoseTwin', audience: 'Radiation oncology', module: 'dosetwin', to: '/studio/dosetwin/cases/current', icon: Activity },
  { label: 'FistulaGuard', audience: 'Nephrology & access care', module: 'fistulaguard', to: '/studio/fistulaguard/cases/current', icon: AudioLines },
]
const workspaceLinks = [
  { label: 'Research workbench', to: '/studio', icon: Layers3 },
  { label: 'Case registry', to: '/studio/cases', icon: Boxes },
  { label: 'Model lab', to: '/studio/models', icon: Microscope },
  { label: 'Experiments', to: '/studio/experiments', icon: FlaskConical },
  { label: 'Evidence reports', to: '/studio/reports', icon: FileText },
  { label: 'Student Academy', to: '/academy', icon: GraduationCap },
  { label: 'Educator studio', to: '/educator', icon: BookOpenCheck },
]
const workspaceOptions = [
  { value: 'professional', label: 'Professional Studio', shortLabel: 'Professional', to: '/studio' },
  { value: 'academy', label: 'Student Academy', shortLabel: 'Student', to: '/academy' },
  { value: 'educator', label: 'Educator Studio', shortLabel: 'Educator', to: '/educator' },
] as const

function MedforgeMark() {
  // The three intersecting planes echo the linked voxel selection used in DoseTwin.
  return <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className="size-[22px] shrink-0">
    <path d="M16 2.75 27.5 9.2v13.6L16 29.25 4.5 22.8V9.2L16 2.75Z" stroke="var(--teal-light)" strokeWidth="1.35" strokeLinejoin="round"/>
    <path d="M4.8 9.4 16 15.8 27.2 9.4M16 15.8v12.8" stroke="var(--blue)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11.4 15.8h9.2M16 11.2v9.2" stroke="var(--teal-light)" strokeWidth="1.15" strokeLinecap="round"/>
    <circle cx="16" cy="15.8" r="1.65" fill="var(--warning)"/>
  </svg>
}

export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const workspace = location.pathname.startsWith('/academy') ? 'academy' : location.pathname.startsWith('/educator') ? 'educator' : 'professional'
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const closeSearch = () => {
    setSearchOpen(false)
    setSearchText('')
    window.requestAnimationFrame(() => searchTriggerRef.current?.focus())
  }
  const sourceCases = useQuery({
    queryKey: queryKeys.cases,
    queryFn: api.cases,
    enabled: searchOpen,
  })
  const title = location.pathname === '/' ? 'Clinical research workbench' : location.pathname.startsWith('/academy') ? 'Student Academy' : location.pathname.startsWith('/educator') ? 'Educator studio' : specialties.find((s) => location.pathname.includes(s.label.toLowerCase()))?.label ?? navigation.find((n) => location.pathname === n.to)?.label ?? 'Professional studio'
  const learning = workspace === 'academy'
    ? [{ label: 'Learning paths', to: '/academy', icon: GraduationCap }, { label: 'Progress & awards', to: '/academy/progress', icon: Trophy }]
    : [{ label: 'Lesson library', to: '/educator', icon: BookOpenCheck }, { label: 'Assignments', to: '/educator/assignments', icon: ClipboardCheck }, { label: 'Submissions', to: '/educator/submissions', icon: FileText }]
  const normalizedSearch = searchText.trim().toLocaleLowerCase()
  const matchingCases = useMemo(() => {
    if (normalizedSearch.length < 2) return []
    return (sourceCases.data ?? []).filter((record) => {
      const specialty = specialties.find((item) => item.module === record.module)
      return [record.id, record.label, record.dataset_id, record.source_case_id, record.reference_kind, specialty?.label, specialty?.audience]
        .some((field) => field?.toLocaleLowerCase().includes(normalizedSearch))
    })
  }, [normalizedSearch, sourceCases.data])
  const shownCaseCount = specialties.reduce((total, item) => total + Math.min(8, matchingCases.filter((record) => record.module === item.module).length), 0)
  const matchingWorkspaces = workspaceLinks.filter((item) => !normalizedSearch || item.label.toLocaleLowerCase().includes(normalizedSearch))
  const matchingSpecialties = specialties.filter((item) => !normalizedSearch || `${item.label} ${item.audience}`.toLocaleLowerCase().includes(normalizedSearch))
  const openDestination = (destination: string) => {
    setSearchOpen(false)
    setSearchText('')
    navigate(destination)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'k') return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'))) return
      event.preventDefault()
      setSearchText('')
      setSearchOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return <SidebarProvider data-workspace={workspace} className="medforge-shell min-h-svh bg-background" defaultOpen style={{ '--sidebar-width': '14rem', '--sidebar-width-icon': '3rem' } as React.CSSProperties}>
    <Sidebar collapsible="icon" className="medforge-sidebar" data-workspace={workspace}>
      <SidebarHeader className="px-2 pt-3 pb-2">
        <SidebarMenu><SidebarMenuItem><SidebarMenuButton size="lg" render={<NavLink to="/" aria-label="MEDFORGE home" />} tooltip="MEDFORGE home"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><MedforgeMark/></span><span className="font-semibold tracking-wide">MEDFORGE</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {workspace === 'professional' && <SidebarGroup>
          <SidebarGroupLabel>Professional Studio</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{navigation.map(({ label, to, icon: Icon, end }) => <SidebarMenuItem key={to}><SidebarMenuButton render={<NavLink to={to} end={end} />} isActive={location.pathname === to || (!end && location.pathname.startsWith(`${to}/`))} tooltip={label}><Icon/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>}
        {workspace === 'professional' && <SidebarGroup>
          <SidebarGroupLabel>Clinical specialties</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{specialties.map(({ label, audience, to, icon: Icon }) => <SidebarMenuItem key={label}><SidebarMenuButton className="h-11" render={<NavLink to={to} />} isActive={location.pathname.startsWith(`/studio/${label.toLowerCase()}`)} tooltip={`${audience} · ${label}`}><Icon/><span className="grid min-w-0 gap-0.5 leading-tight"><span className="truncate">{audience}</span><span className="text-[10px] font-normal text-muted-foreground">{label}</span></span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>}
        {workspace === 'professional' && <SidebarSeparator />}
        {workspace !== 'professional' && <SidebarGroup>
          <SidebarGroupLabel>{workspace === 'academy' ? 'Your learning' : 'Teaching'}</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{learning.map(({ label, to, icon: Icon }) => <SidebarMenuItem key={to}><SidebarMenuButton render={<NavLink to={to} />} isActive={location.pathname === to || location.pathname.startsWith(`${to}/`)} tooltip={label}><Icon/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>}
        {workspace !== 'professional' && <SidebarGroup>
          <SidebarGroupLabel>Switch workspace</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu><SidebarMenuItem><SidebarMenuButton render={<NavLink to="/studio" />} tooltip="Professional Studio"><Microscope/><span>Professional Studio</span></SidebarMenuButton></SidebarMenuItem>{workspace === 'academy' ? <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/educator" />} tooltip="Educator Studio"><BookOpenCheck/><span>Educator Studio</span></SidebarMenuButton></SidebarMenuItem> : <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/academy" />} tooltip="Student Academy"><GraduationCap/><span>Student Academy</span></SidebarMenuButton></SidebarMenuItem>}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>}
      </SidebarContent>
      <SidebarFooter className="p-2"><SidebarMenu><SidebarMenuItem><SidebarMenuButton size="sm" tooltip="Research & education only" className="text-muted-foreground"><ShieldCheck/><span>Research &amp; education</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
    </Sidebar>
    <SidebarInset className="flex min-h-svh min-w-0 flex-col bg-background">
      <header className="medforge-toolbar flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground sm:gap-3"><SidebarTrigger aria-label="Toggle navigation"/><span className="hidden sm:inline">MEDFORGE</span><span aria-hidden="true" className="hidden text-border sm:inline">/</span><b className="truncate font-medium text-foreground">{title}</b></div>
        <div className="flex shrink-0 items-center gap-2">
          <Select items={workspaceOptions} value={workspace} onValueChange={(value) => {
            const option = workspaceOptions.find((item) => item.value === value)
            if (option && option.value !== workspace) navigate(option.to)
          }}>
            <SelectTrigger aria-label="Switch workspace" size="sm" className="max-w-[152px] sm:max-w-48">
              <SelectValue>{(value) => workspaceOptions.find((item) => item.value === value)?.shortLabel ?? 'Workspace'}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {workspaceOptions.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button ref={searchTriggerRef} variant="outline" size="sm" className="w-8 px-0 sm:w-auto sm:justify-start sm:px-2.5" aria-label="Find a research case or workspace" onClick={() => { setSearchText(''); setSearchOpen(true) }}>
            <Search data-icon="inline-start" />
            <span className="hidden sm:inline">Find case or workspace</span>
            <kbd className="ml-3 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground lg:inline">⌘ K</kbd>
          </Button>
          <Badge variant="outline" aria-label="Local evidence workspace" className="hidden shrink-0 gap-2 rounded-full px-2.5 py-1 font-normal text-muted-foreground xl:inline-flex"><span aria-hidden="true" className="size-2 rounded-full bg-primary"/>Local evidence workspace</Badge>
        </div>
      </header>
      <CommandDialog
        open={searchOpen}
        onOpenChange={(open) => { if (open) setSearchOpen(true); else closeSearch() }}
        title="Find a research case or workspace"
        description="Search specialty workspaces and verified source cases by dataset or case ID."
      >
        <Command shouldFilter={false} loop>
          <CommandInput
            autoFocus
            aria-label="Search cases, datasets, specialties, and workspaces"
            placeholder="Case ID, dataset, specialty, or workspace"
            value={searchText}
            onValueChange={setSearchText}
          />
          <CommandList>
            {matchingWorkspaces.length > 0 && <CommandGroup heading="Workspaces">
              {matchingWorkspaces.map(({ label, to, icon: Icon }) => <CommandItem key={to} value={`workspace:${label}`} onSelect={() => openDestination(to)}>
                <Icon aria-hidden="true" className="text-muted-foreground" />
                <span>{label}</span>
              </CommandItem>)}
            </CommandGroup>}
            {matchingSpecialties.length > 0 && <CommandGroup heading="Specialties">
              {matchingSpecialties.map(({ label, audience, to, icon: Icon }) => <CommandItem key={to} value={`specialty:${label}:${audience}`} onSelect={() => openDestination(to)}>
                <Icon aria-hidden="true" className="text-primary" />
                <span className="grid min-w-0 gap-0.5"><span>{label}</span><span className="text-xs text-muted-foreground">{audience}</span></span>
              </CommandItem>)}
            </CommandGroup>}
            {normalizedSearch.length > 0 && normalizedSearch.length < 2 && <p className="px-3 py-3 text-xs text-muted-foreground">Enter at least two characters to search verified source cases.</p>}
            {normalizedSearch.length >= 2 && matchingCases.length > 0 && <>
              {specialties.map(({ module, label, icon: Icon }) => {
                const group = matchingCases.filter((record) => record.module === module)
                if (!group.length) return null
                return <CommandGroup key={module} heading={`${label} · ${group.length} ${group.length === 1 ? 'case' : 'cases'}`}>
                  {group.slice(0, 8).map((record: CaseRecord) => <CommandItem key={record.id} value={`case:${record.label}:${record.id}:${record.source_case_id}:${record.dataset_id}:${record.reference_kind}`} className="items-start" onSelect={() => openDestination(`/studio/${record.module}/cases/${encodeURIComponent(record.id)}`)}>
                    <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="truncate font-medium">{record.label}</span>
                      <span className="truncate text-xs text-muted-foreground">{record.dataset_id} · source {record.source_case_id} · {record.reference_kind}</span>
                    </span>
                  </CommandItem>)}
                </CommandGroup>
              })}
            </>}
            {normalizedSearch.length >= 2 && sourceCases.isFetching && <p className="px-3 py-3 text-xs text-muted-foreground">Loading verified source cases…</p>}
            {normalizedSearch.length >= 2 && !sourceCases.isFetching && matchingCases.length === 0 && matchingWorkspaces.length === 0 && matchingSpecialties.length === 0 && <CommandEmpty>{sourceCases.isError ? 'The local case registry is unavailable. Retry from the Case Registry page.' : 'No workspace or verified source case matches that search.'}</CommandEmpty>}
            {!normalizedSearch && <p className="px-3 py-3 text-xs text-muted-foreground">Search IDs such as <span className="font-mono text-foreground">pt_201</span>, source names such as <span className="text-foreground">FiSaV</span>, or a specialty.</p>}
          </CommandList>
        </Command>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span>Results open the local, source-backed workspace.</span>
          {matchingCases.length > shownCaseCount && <Button variant="outline" size="xs" className="h-7" onClick={() => openDestination(`/studio/cases?q=${encodeURIComponent(searchText.trim())}`)}>
            <Boxes data-icon="inline-start" />
            All {matchingCases.length.toLocaleString()} matches
          </Button>}
          <span className="hidden shrink-0 sm:inline"><kbd className="rounded border border-border px-1">↑</kbd> <kbd className="rounded border border-border px-1">↓</kbd> move <kbd className="ml-2 rounded border border-border px-1">Enter</kbd> open <kbd className="ml-2 rounded border border-border px-1">Esc</kbd> close</span>
        </div>
      </CommandDialog>
      <OfflineBanner />
      <div className={`medforge-content mx-auto flex w-full flex-1 flex-col px-4 py-5 pb-12 sm:px-6 lg:px-8 ${workspace === 'professional' ? 'max-w-none' : 'max-w-[1160px]'} xl:py-7`}><Suspense fallback={<div className="grid gap-4" role="status" aria-label="Loading workspace"><Skeleton className="h-4 w-28"/><Skeleton className="h-9 w-64"/><Skeleton className="h-4 w-96 max-w-full"/><div className="mt-4 grid gap-3 md:grid-cols-3"><Skeleton className="h-40"/><Skeleton className="h-40"/><Skeleton className="h-40"/></div></div>}><Outlet /></Suspense></div>
      <footer className="flex flex-wrap items-center gap-2 border-t border-sidebar-border px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-6 lg:px-8"><ShieldCheck aria-hidden="true" className="size-4 text-primary"/> MEDFORGE is for research and education. It is not for patient diagnosis or treatment decisions.</footer>
    </SidebarInset>
  </SidebarProvider>
}

export const domainIcons = { surgivision: Stethoscope, dosetwin: Activity, fistulaguard: Radio }
