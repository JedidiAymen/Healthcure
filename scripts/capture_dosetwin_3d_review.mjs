import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const baseUrl=process.env.UI_REVIEW_BASE_URL??'http://127.0.0.1:15177'
const outputDir=process.env.UI_REVIEW_DIR??'.local-review/FIX-04'
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
    await page.getByText('Open 3D view',{exact:true}).click()
    const screenshotLabel=page.getByLabel('Structure to reconstruct')
    let surfaceReadyMs=null
    if(viewport.width>480){
      const buildStarted=Date.now()
      await screenshotLabel.selectOption('PTV70')
      await page.getByText(/14,928 triangles/).waitFor({state:'visible',timeout:30000})
      surfaceReadyMs=Date.now()-buildStarted
    }else{
      await page.getByText(/3D rendering is paused on this narrow screen/).waitFor({state:'visible',timeout:15000})
    }
    const viewportNode=page.getByTestId('dosetwin-3d-viewport')
    await viewportNode.scrollIntoViewIfNeeded()
    await page.waitForTimeout(100)
    const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth}))
    const file=path.join(outputDir,`dosetwin-3d-${viewport.name}.png`)
    await page.screenshot({path:file,animations:'disabled'})
    results.push({viewport:viewport.name,status:response?.status()??null,horizontalOverflow:metrics.documentWidth>metrics.width,renderedSource:viewport.width>480?'OpenKBP pt_201 · PTV70.csv':'D1 fallback · narrow-screen 3D guard',surfaceReadyMs,pageErrors:errors,screenshot:path.resolve(file)})
    await page.close()
  }
}finally{await browser.close()}
await writeFile(path.join(outputDir,'report.json'),`${JSON.stringify({baseUrl,results},null,2)}\n`)
console.log(JSON.stringify({baseUrl,results},null,2))
