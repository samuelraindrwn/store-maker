import { expect, test, type Page } from '@playwright/test';
import { createInitialShop, getWallHeight, type ShopDocument } from '../src/model';
import { LEVEL_SLAB } from '../src/scene/buildingObjects';

test.use({ reducedMotion: 'reduce' });
const KEY = 'nemu.store-maker.v1';
const canvas = (page: Page) => page.locator('canvas[data-renderer="webgl"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<ShopDocument> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
const data = async (page: Page, key: string) => JSON.parse(await canvas(page).getAttribute(`data-${key}`) || 'null');
async function ready(page: Page, level?: number) {
  if (level !== undefined) await expect(canvas(page)).toHaveAttribute('data-active-level', String(level));
  await expect(page.locator('.shop-canvas')).toHaveAttribute('aria-busy', 'false');
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
}

test('upper floors show the lower building faintly, keep real stair openings, and remain editable by pointer', async ({ page }, info) => {
  test.setTimeout(120_000);
  if (info.project.name === 'chromium') await page.setViewportSize({ width:1560, height:1050 });
  const doc = createInitialShop();
  doc.upperFloors![0].items = [{ id:'upstairs-stool',kind:'stool',x:3,z:4,rotation:0,color:'#B58C65',stock:'none' }];
  await page.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, {key:KEY,doc});
  const errors: string[]=[]; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await ready(page,0);
  const surface = await canvas(page).elementHandle();
  await button(page,'Edit lantai 2').click(); await ready(page,1);
  expect(await surface!.evaluate(node => node.isConnected)).toBe(true);
  const elevation = getWallHeight(doc) + LEVEL_SLAB;
  expect(await data(page,'active-floor-y')).toBeCloseTo(elevation);
  expect(await data(page,'ground-y')).toBeCloseTo(-0.401-elevation);
  expect(await data(page,'context-levels')).toEqual([{level:0,floorY:0,opacity:0.2,sceneY:-elevation}]);
  expect(await data(page,'stair-openings')).toEqual([expect.objectContaining({stairId:'ground-stairs',exitSide:'north'})]);
  expect((await data(page,'item-centers')).map((item: {id:string}) => item.id)).toEqual(['upstairs-stool']);
  await canvas(page).screenshot({path:info.outputPath('upper-floor-with-stairwell.png')});
  await canvas(page).scrollIntoViewIfNeeded();
  const points = await canvas(page).evaluate(surface => {
    const data=(surface as HTMLElement).dataset, rect=surface.getBoundingClientRect();
    const item=JSON.parse(data.itemCenters!).find((p:{id:string})=>p.id==='upstairs-stool');
    const cells=JSON.parse(data.cellCenters!);
    const a=cells.find((p:{x:number;z:number})=>p.x===3&&p.z===4);
    const b=cells.find((p:{x:number;z:number})=>p.x===5&&p.z===4);
    return {x:rect.x+item.canvasX,y:rect.y+item.canvasY,dx:b.canvasX-a.canvasX,dy:b.canvasY-a.canvasY};
  });
  const session = info.project.name==='mobile-chromium' ? await page.context().newCDPSession(page) : null;
  if(session) await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:points.x,y:points.y}]});
  else {await page.mouse.move(points.x,points.y);await page.mouse.down();}
  for(let step=1;step<=8;step++) {
    const point={x:points.x+points.dx*step/8,y:points.y+points.dy*step/8};
    if(session) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,...point}]});
    else await page.mouse.move(point.x,point.y);
  }
  if(session) {await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();}
  else await page.mouse.up();
  await expect.poll(async ()=>(await saved(page)).upperFloors![0].items[0].x).toBe(5);
  expect((await saved(page)).items).toEqual(doc.items);
  await button(page,'Urungkan').click();
  await expect.poll(async ()=>(await saved(page)).upperFloors![0].items[0].x).toBe(3);
  await page.getByLabel('Jumlah lantai',{exact:true}).selectOption('4');
  await button(page,'Edit lantai 4').click();await ready(page,3);
  expect((await data(page,'context-levels')).map((floor:{level:number})=>floor.level)).toEqual([0,1,2]);
  await canvas(page).screenshot({path:info.outputPath('four-floor-context.png')});
  await button(page,'Edit lantai 1').click();await ready(page,0);
  expect(await data(page,'context-levels')).toEqual([]);
  expect(await data(page,'ground-y')).toBe(-0.401);
  expect(errors).toEqual([]);
});

test('view changes paint a loader before new geometry, reuse WebGL and settle on the last requested view',async({page},info)=>{
  test.setTimeout(90_000);
  if(info.project.name==='chromium') await page.setViewportSize({width:1560,height:1050});
  await page.goto('/');await ready(page,0);
  const surface=await canvas(page).elementHandle();
  await page.evaluate(()=>{
    const root=document.querySelector('.shop-canvas')!;
    const events: {busy:string|null;exterior:string|undefined;paint?:boolean}[]=[];
    (window as unknown as {sceneTransitions:typeof events}).sceneTransitions=events;
    new MutationObserver(()=>{
      const busy=root.getAttribute('aria-busy');
      events.push({busy,exterior:root.querySelector('canvas')?.dataset.exteriorOnly});
      if(busy==='true') requestAnimationFrame(()=>events.push({busy:root.getAttribute('aria-busy'),exterior:root.querySelector('canvas')?.dataset.exteriorOnly,paint:true}));
    }).observe(root,{attributes:true,attributeFilter:['aria-busy']});
  });
  await button(page,'Eksterior').click();
  await expect(canvas(page)).toHaveAttribute('data-exterior-only','true');await ready(page);
  const events=await page.evaluate(()=>(window as unknown as {sceneTransitions: {busy:string;exterior:string;paint?:boolean}[]}).sceneTransitions);
  expect(events).toEqual(expect.arrayContaining([expect.objectContaining({busy:'true',exterior:'false'}),expect.objectContaining({busy:'true',paint:true}),expect.objectContaining({busy:'false',exterior:'true'})]));
  expect(await surface!.evaluate(node=>node.isConnected)).toBe(true);
  await page.evaluate(()=>new Promise<void>(resolve=>{
    const click=(name:string)=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.trim()===name)!.click();
    click('Interior');
    requestAnimationFrame(()=>{click('Eksterior');resolve();});
  }));
  await expect(canvas(page)).toHaveAttribute('data-exterior-only','true');await ready(page);
  await page.evaluate(()=>{
    const click=(name:string)=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.trim()===name)!.click();
    click('Interior');click('Eksterior');click('Interior');
  });
  await expect(canvas(page)).toHaveAttribute('data-exterior-only','false');await ready(page);
  expect(await surface!.evaluate(node=>node.isConnected)).toBe(true);
  expect(await page.locator('canvas[data-renderer="webgl"]').count()).toBe(1);
});
