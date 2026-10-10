import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const baseUrl=process.env.UI_REVIEW_BASE_URL??'http://127.0.0.1:15178'
const outputDir=process.env.UI_REVIEW_DIR??'.local-review/FIX-05'
const sizes=[{width:1440,height:900,name:'1440x900'},{width:768,height:1024,name:'768x1024'},{width:390,height:844,name:'390x844'}]
await mkdir(outputDir,{recursive:true})
const browser=await chromium.launch({headless:true})
const results=[]
try{
 for(const viewport of sizes){
  const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>localStorage.clear())
  const response=await page.goto(new URL('/studio/dosetwin/cases/current',baseUrl).href,{waitUntil:'networkidle',timeout:30000})
  await page.getByText('Compare a real dose prediction',{exact:true}).click()
  await page.getByText('No compatible second array is installed.',{exact:true}).waitFor({state:'visible',timeout:15000})
  const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth}))
  const file=path.join(outputDir,`dosetwin-comparison-${viewport.name}.png`)
  await page.screenshot({path:file,fullPage:true,animations:'disabled'})
  results.push({viewport:viewport.name,httpStatus:response?.status()??null,horizontalOverflow:metrics.documentWidth>metrics.width,actualState:'OpenKBP pt_201 reference source · no second prediction installed · comparison import empty state',pageErrors:errors,screenshot:path.resolve(file)})
  await page.close()
 }
}finally{await browser.close()}
await writeFile(path.join(outputDir,'report.json'),`${JSON.stringify({baseUrl,results},null,2)}\n`)
console.log(JSON.stringify({baseUrl,results},null,2))
