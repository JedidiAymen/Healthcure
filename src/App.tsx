import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { LearningRoleGate, SessionProvider } from './lib/session'

const Home = lazy(() => import('./pages/Pages').then(page => ({ default: page.Home })))
const Studio = lazy(() => import('./pages/Pages').then(page => ({ default: page.Studio })))
const Cases = lazy(() => import('./pages/Pages').then(page => ({ default: page.Cases })))
const DomainWorkspace = lazy(() => import('./pages/Pages').then(page => ({ default: page.DomainWorkspace })))
const Models = lazy(() => import('./pages/Pages').then(page => ({ default: page.Models })))
const Experiments = lazy(() => import('./pages/Pages').then(page => ({ default: page.Experiments })))
const Reports = lazy(() => import('./pages/Pages').then(page => ({ default: page.Reports })))
const Academy = lazy(() => import('./pages/Pages').then(page => ({ default: page.Academy })))
const Mission = lazy(() => import('./pages/Pages').then(page => ({ default: page.Mission })))
const Progress = lazy(() => import('./pages/Pages').then(page => ({ default: page.Progress })))
const StudentLearningPathPage = lazy(() => import('./pages/StudentLearningPath').then(page => ({ default: page.StudentLearningPathPage })))
const Educator = lazy(() => import('./pages/Pages').then(page => ({ default: page.Educator })))
const LessonEditor = lazy(() => import('./pages/LessonEditor').then(page => ({ default: page.LessonEditorPage })))
const Assignments = lazy(() => import('./pages/Pages').then(page => ({ default: page.Assignments })))
const AccountPage = lazy(() => import('./pages/Account').then(page => ({ default: page.AccountPage })))
const Submissions = lazy(() => import('./pages/Pages').then(page => ({ default: page.Submissions })))
const EducatorLearners = lazy(() => import('./pages/EducatorLearners').then(page => ({ default: page.EducatorLearnersPage })))

export default function App() {
  return <SessionProvider><Routes><Route element={<Shell />}>
    <Route path="/" element={<Home/>}/>
    <Route path="/studio" element={<Studio/>}/><Route path="/studio/cases" element={<Cases/>}/>
    <Route path="/studio/surgivision/cases/:caseId" element={<DomainWorkspace module="surgivision"/>}/>
    <Route path="/studio/dosetwin/cases/:caseId" element={<DomainWorkspace module="dosetwin"/>}/>
    <Route path="/studio/fistulaguard/cases/:caseId" element={<DomainWorkspace module="fistulaguard"/>}/>
    <Route path="/studio/models" element={<Models/>}/><Route path="/studio/experiments" element={<Experiments/>}/><Route path="/studio/reports" element={<Reports/>}/>
    <Route path="/academy" element={<LearningRoleGate role="student"><Academy/></LearningRoleGate>}/><Route path="/academy/paths/:pathId" element={<LearningRoleGate role="student"><StudentLearningPathPage/></LearningRoleGate>}/><Route path="/academy/missions/:missionId" element={<LearningRoleGate role="student"><Mission/></LearningRoleGate>}/><Route path="/academy/progress" element={<LearningRoleGate role="student"><Progress/></LearningRoleGate>}/>
    <Route path="/educator" element={<LearningRoleGate role="educator"><Educator/></LearningRoleGate>}/><Route path="/educator/cases/:lessonId/edit" element={<LearningRoleGate role="educator"><LessonEditor/></LearningRoleGate>}/><Route path="/educator/assignments" element={<LearningRoleGate role="educator"><Assignments/></LearningRoleGate>}/><Route path="/educator/submissions" element={<LearningRoleGate role="educator"><Submissions/></LearningRoleGate>}/><Route path="/educator/learners" element={<LearningRoleGate role="educator"><EducatorLearners/></LearningRoleGate>}/>
    <Route path="/account" element={<AccountPage/>}/>
    <Route path="*" element={<Home/>}/>
  </Route></Routes></SessionProvider>
}
