/* Repository-native SVG; no CDN or CodeGraph index required. */
(function () {
  'use strict';
  const root = document.getElementById('codegraph');
  const svg = document.getElementById('cg-svg');
  const NS = 'http://www.w3.org/2000/svg';
  const api = 'apps/api/src/';
  const extra = window.HOMELAND_GRAPH_EXTRA || {height:1330, colors:{}, groups:[], nodes:[], edges:[]};
  const graphHeight = extra.height;
  svg.setAttribute('viewBox', '0 0 2600 '+graphHeight);
  const colors = { ai:['#e8e7ff','#7264ed'], auto:['#fff0f3','#ec547b'], prop:['#fff1ce','#ed961d'], money:['#e0f7e7','#2db764'], access:['#e3ebff','#4e7de8'] };
  const groups = [
    ['ai','AI and Documents',30,30,550,330],
    ['auto','Automation and Communication',650,30,920,330],
    ['prop','Property Operations',1650,30,920,330],
    ['money','Billing and Finance',30,590,1520,700],
    ['access','Access and Tenancy',1640,590,930,700]
  ];
  // id, label, file, group, x, y, finding, detail, shape.
  const nodes = [
    ['storage','File Storage',api+'documents/providers/storage/storage.module.ts','ai',60,95,'','DocumentsService đọc/ghi qua StorageProvider. Không suy ra storage hỏng chỉ vì diagram cũ thiếu đường nối.','db'],
    ['documents','Documents Service',api+'documents/documents.service.ts','ai',60,240,'THIẾU','Engine có GENERATE_DOCUMENT / REQUEST_SIGNATURE nhưng registry chưa dùng; kết quả tạo document chưa được truyền documentId sang bước ký.'],
    ['ai','AI Service',api+'ai/ai.service.ts','ai',330,240,'','Chat/embed đi qua provider; các tool nghiệp vụ và KnowledgeService cần kiểm tra riêng.'],
    ['provider','AI Provider',api+'ai/providers/openai.provider.ts','ai',330,440,'','Nhận yêu cầu inference từ AiService.'],
    ['workflow','Workflow Engine',api+'automation/workflow/workflow.engine.ts','auto',680,100,'SAI','WRITE_AUTOMATION_AUDIT chỉ logger.debug. CREATE_JOURNAL_ENTRY gọi JournalEntryService, không gọi FinanceLedgerService.'],
    ['rule','Rule Engine',api+'automation/rules/rule.engine.ts','auto',980,100,'','RuleScheduler gọi rule; engine kiểm tra condition, dispatch và lưu RuleExecution.'],
    ['template','Template Engine',api+'communication/templates/template.engine.ts','auto',1280,100,'','CommunicationService tạo TemplateEngine và gọi compile. Đây là code đang dùng, không phải code chết.'],
    ['communication','Communication Service',api+'communication/communication.service.ts','auto',980,265,'SAI','SMSProvider và PushProvider trả success:true, stub:true; worker vẫn ghi DELIVERED. Không đồng nghĩa provider Zalo cũng là stub.'],
    ['customers','Customers Service',api+'customers/customers.service.ts','prop',1680,100,'','Hồ sơ khách và kiểm tra trùng; Customer.roomId là dữ liệu tương thích, không thay thế lịch sử Occupancy.'],
    ['buildings','Buildings Service',api+'buildings/buildings.service.ts','prop',1980,100,'','Quản lý tòa nhà; quan hệ Building → Floor → Room nằm trong Prisma schema.'],
    ['rooms','Rooms Service',api+'rooms/rooms.service.ts','prop',2280,100,'','List phòng gồm contracts/roommates. Trạng thái và số người cần đối chiếu Occupancy; không kết luận toàn service thiếu logic.'],
    ['contracts','Contracts Service',api+'contracts/contracts.service.ts','prop',1980,265,'','Activate/renew/transfer/settlement là các command vòng đời. Đồng bộ Contract, RentalCycle, Occupancy và trạng thái phòng.'],
    ['zalo','Zalo Messaging',api+'communication/providers/communication.providers.ts','auto',1330,440,'','ZaloProvider gọi HTTP API gửi tin; external side effect, tách biệt với SMS/Push stub.'],
    ['sepay','SePay Webhook',api+'payments/payments.controller.ts','money',680,440,'','Webhook vào PaymentsService; xác thực, đối soát PaymentRequest, phân bổ invoice/deposit, xử lý thừa tiền.'],
    ['owner','Owner or Staff','apps/web/app/login/page.tsx','access',2310,430,'','Người vận hành đăng nhập và mở ứng dụng.','actor'],
    ['deposit','Deposit Core',api+'deposits/deposit-core.service.ts','money',60,670,'','Command cọc dùng lock, idempotency, DepositOperation, DepositLedgerEntry và outbox. Không nhầm với method convertToContract legacy.'],
    ['invoice','Invoice Service',api+'invoices/invoices.service.ts','money',360,670,'','pay ghi Payment + PaymentAllocation, cập nhật invoice và outbox trong transaction; overdue event chưa có automation listener.'],
    ['payment','Payment Service',api+'payments/payments.service.ts','money',660,670,'','PaymentRequest/QR và SePay reconciliation; invoice payment gọi InvoicesService.pay.'],
    ['monthly','Monthly Settlement',api+'monthly-settlement/monthly-settlement.service.ts','money',960,670,'','Hunonic reading + roster → BillingSnapshot → MONTHLY_BASE invoice. Snapshot kỳ khóa cần giữ bất biến.'],
    ['reports','Reports / Exports',api+'reports/reports.controller.ts','money',1260,670,'SAI','PDF export trả buffer văn bản nhưng gắn MIME application/pdf. ReportScheduler chỉ log, chưa generate/save/send report.'],
    ['ledger','Ledger Service',api+'finance/ledger.service.ts','money',60,1040,'CHƯA DÙNG','getAccountBalance chỉ thấy ở service, module và test; chưa thấy consumer nghiệp vụ. FinanceController dùng FinanceReportingService.'],
    ['journal','Journal Entry Service',api+'finance/journal-entry.service.ts','money',360,1040,'','Đích thực tế của CREATE_JOURNAL_ENTRY trong WorkflowEngine. Sổ kế toán khác DepositLedgerEntry.'],
    ['outbox','Outbox Publisher',api+'deposits/deposit-outbox.publisher.ts','money',660,1040,'','Claim FOR UPDATE SKIP LOCKED; publishAsync; retry FAILED. Job background xử lý nhiều tenant là chủ ý, chưa đủ căn cứ coi đây là lỗi tenant.'],
    ['hunonic','Hunonic Service',api+'hunonic/hunonic.service.ts','money',960,1040,'','Đồng bộ công tơ/reading; MonthlySettlement sử dụng reading và BillingSnapshot.'],
    ['pdf','PDF Export Provider',api+'reports/export/pdf-export.provider.ts','money',1260,1040,'SAI','generateBuffer không render PDF: trả Buffer.from(placeholderText). Cần render thật hoặc báo chưa hỗ trợ.'],
    ['occupancy','Occupancy / RentalCycle','packages/database/prisma/schema.prisma','access',1680,670,'','Nguồn lịch sử cư trú và kỳ thuê; liên kết Contract/Customer/Room/Invoice/Payment/Deposit.','db'],
    ['login','Login','apps/web/app/login/page.tsx','access',2280,670,'','Giao diện đăng nhập đi qua API authentication; Settings có nhóm riêng phía dưới.'],
    ['auth','Authentication / Guards',api+'auth/auth.service.ts','access',2280,835,'','JWT, refresh token, permission guards và tenant context. PrismaService.tx hỗ trợ scope; không tự scope mọi truy vấn direct prisma.'],
    ['database','Tenant Database',api+'prisma.service.ts','access',1930,1110,'','Prisma / PostgreSQL. Code dùng direct prisma cần điều kiện tenant tường minh; quan hệ trong sơ đồ là các đường tiêu biểu, không phải mọi query.','db'],
    ['audit','Audit Service',api+'shared/audit/audit.service.ts','access',2280,1110,'','AuditService được dùng trong nghiệp vụ; riêng step WRITE_AUTOMATION_AUDIT chưa ghi AuditLog.'],
    ['overdue','invoice.overdue',api+'automation/automation.listener.ts','money',670,865,'THIẾU','Invoice service phát event và registry có workflow, nhưng AutomationListener không có @OnEvent(invoice.overdue). Rule nhắc 7 ngày là đường khác.'],
    ['tools','AI tools / RAG',api+'ai/tools/definitions/finance.tools.ts','ai',60,440,'SAI','Các tool finance/rooms/dashboard/documents trả dữ liệu cố định. KnowledgeService chỉ embedding metadata, chưa đọc nội dung file.']
  ].map(n=>({id:n[0],label:n[1],file:n[2],group:n[3],x:n[4],y:n[5],issue:n[6],detail:n[7],shape:n[8],w:230,h:78}));
  Object.assign(colors, extra.colors);
  groups.push(...extra.groups);
  nodes.push(...extra.nodes.map(n=>({id:n[0],label:n[1],file:n[2],group:n[3],x:n[4],y:n[5],issue:n[6],detail:n[7],shape:n[8],w:230,h:78})));
  const byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
  // Explicit orthogonal routes keep paths outside unrelated service boxes.
  const edges = [
    ['documents','storage','đọc / ghi file','M175 240 V173',175,205],
    ['ai','provider','inference','M445 318 V440',445,395,'async'],
    ['tools','ai','tools / embed','M290 479 H310 V279 H330',310,378],
    ['workflow','communication','dispatch','M795 178 V214 H1075 V265',898,214],
    ['rule','communication','dispatch alerts','M1095 178 V265',1152,224],
    ['communication','template','compile','M1210 304 H1395 V178',1395,228],
    ['communication','zalo','send messages','M1210 320 H1445 V440',1445,398,'async'],
    ['buildings','rooms','Building → Floor → Room','M2210 139 H2280',2245,115],
    ['contracts','customers','customerId','M2095 265 V212 H1795 V178',1858,212],
    ['contracts','occupancy','activate / move-out','M2095 343 V390 H1620 V709 H1680',1784,390],
    ['owner','login','opens app','M2425 508 V670',2425,565],
    ['login','auth','authenticates','M2395 748 V835',2395,792],
    ['auth','database','tenant / token data','M2280 874 H2225 V1060 H2045 V1110',2225,999],
    ['auth','audit','audits changes','M2395 913 V1110',2395,1025],
    ['occupancy','database','persist relations','M1795 748 V1150 H1930',1795,997],
    ['sepay','payment','webhook','M795 518 V620 H775 V670',795,568,'async'],
    ['payment','invoice','pay','M660 709 H590',625,692],
    ['hunonic','monthly','persisted readings','M1075 1040 V748',1075,899],
    ['monthly','invoice','MONTHLY_BASE','M960 685 H920 V632 H475 V670',634,632],
    ['reports','pdf','exportData(pdf)','M1375 748 V1040',1375,900],
    ['invoice','outbox','transaction + event','M475 748 V810 H610 V1079 H660',542,810,'async'],
    ['deposit','outbox','append outbox','M175 748 V857 H315 V990 H637 V1100 H660',452,990,'async'],
    ['outbox','workflow','publishAsync → listener','M775 1118 V1310 H15 V380 H610 V139 H680',376,380,'async'],
    ['workflow','journal','CREATE_JOURNAL_ENTRY','M795 100 V18 H590 V540 H325 V1079 H360',439,540],
    ['invoice','overdue','emit overdue','M590 729 H640 V904 H670',640,853,'async'],
    ['overdue','workflow','THIẾU @OnEvent','M900 904 H935 V409 H815 V178',935,510,'gap'],
    ['workflow','documents','chưa nối registry','M680 161 H627 V332 H305 V279 H290',420,332,'gap']
  ];
  edges.push(...extra.edges);
  function el(tag,attrs,text){const e=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;return e;}
  const defs=el('defs');
  ['normal','gap'].forEach(kind=>{const m=el('marker',{id:'cg-arrow-'+kind,viewBox:'0 0 10 8',refX:9,refY:4,markerWidth:8,markerHeight:8,orient:'auto'});m.append(el('path',{d:'M0 0 L10 4 L0 8 Z',fill:kind==='gap'?'#b91c1c':'#53505e'}));defs.append(m);});svg.append(defs);
  const style=el('style',{},'.cg-node text{font-family:Arial,sans-serif}.cg-node:focus{outline:none}.cg-node:focus .cg-shape{stroke-width:4}.cg-edge text{font-family:Arial,sans-serif;paint-order:stroke;stroke:#f1e6fd;stroke-width:6;stroke-linejoin:round}.cg-node:hover .cg-shape{stroke-width:3}');svg.append(style);
  groups.forEach(([id,title,x,y,w,h])=>{svg.append(el('rect',{x,y,width:w,height:h,fill:'#fafafa',stroke:'#dedce5','stroke-width':2}));svg.append(el('text',{x:x+w/2,y:y+32,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':22,fill:'#27232f'},title));});
  const edgeEls=[];
  edges.forEach(([from,to,label,d,lx,ly,kind])=>{const g=el('g',{'class':'cg-edge','data-from':from,'data-to':to});g.append(el('path',{d,fill:'none',stroke:kind==='gap'?'#b91c1c':'#53505e','stroke-width':1.8,'stroke-dasharray':kind==='gap'?'9 5':kind==='async'?'3 4':'none','marker-end':'url(#cg-arrow-'+(kind==='gap'?'gap':'normal')+')'}));g.append(el('text',{x:lx,y:ly-8,'text-anchor':'middle','font-size':15,fill:kind==='gap'?'#991b1b':'#39343f'},label));svg.append(g);edgeEls.push(g);});
  const nodeEls = new Map();
  nodes.forEach(n=>{const [fill,stroke]=colors[n.group],g=el('g',{class:'cg-node',tabindex:0,role:'button','aria-label':n.label+(n.issue?' — '+n.issue:''),'data-node':n.id});
    if(n.shape==='actor'){g.append(el('ellipse',{cx:n.x+n.w/2,cy:n.y+n.h/2,rx:82,ry:59,fill,stroke,'stroke-width':2,class:'cg-shape'}));}
    else if(n.shape==='db'){g.append(el('path',{d:`M${n.x} ${n.y+14} A115 14 0 0 1 ${n.x+n.w} ${n.y+14} V${n.y+n.h-14} A115 14 0 0 1 ${n.x} ${n.y+n.h-14} Z`,fill,stroke,'stroke-width':2,class:'cg-shape'}));g.append(el('ellipse',{cx:n.x+115,cy:n.y+14,rx:115,ry:14,fill,stroke,'stroke-width':2}));}
    else g.append(el('rect',{x:n.x,y:n.y,width:n.w,height:n.h,fill,stroke,'stroke-width':2,class:'cg-shape'}));
    g.append(el('text',{x:n.x+n.w/2,y:n.y+38,'text-anchor':'middle','font-size':19,fill:'#242135'},n.label));
    const name=n.file.split('/').pop();g.append(el('text',{x:n.x+n.w/2,y:n.y+60,'text-anchor':'middle','font-size':14,fill:'#454052'},'['+name+']'));
    if(n.issue){g.append(el('rect',{x:n.x+10,y:n.y-20,width:140,height:25,rx:3,fill:n.issue==='CHƯA DÙNG'?'#475569':'#b91c1c'}));g.append(el('text',{x:n.x+80,y:n.y-3,'text-anchor':'middle','font-size':14,fill:'#fff'},(n.issue==='CHƯA DÙNG'?'◌ ':'● ')+n.issue));}
    g.append(el('title',{},n.file+'\n'+n.detail));g.addEventListener('click',()=>select(n.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(n.id);}});svg.append(g);nodeEls.set(n.id,g);
  });
  function select(id){const n=byId[id];nodeEls.forEach((g,key)=>g.classList.toggle('cg-selected',key===id));const d=document.getElementById('cg-detail');d.replaceChildren();const h=document.createElement('strong');h.textContent=n.label+(n.issue?' · '+n.issue:'');const p=document.createElement('p');p.textContent=n.detail;const c=document.createElement('code');c.textContent=n.file;const list=document.createElement('ul');edges.filter(e=>e[0]===id||e[1]===id).forEach(e=>{const li=document.createElement('li');li.textContent=byId[e[0]].label+' → '+byId[e[1]].label+' · '+e[2];list.append(li);});d.append(h,p,c,list);}
  const findings=document.getElementById('cg-findings');
  nodes.filter(n=>n.issue).forEach(n=>{const card=document.createElement('article');card.className='cg-finding';const h=document.createElement('h3');h.textContent=n.issue+' · '+n.label;const p=document.createElement('p');p.textContent=n.detail;const code=document.createElement('code');code.textContent=n.file;const b=document.createElement('button');b.textContent='Xem trên sơ đồ';b.addEventListener('click',()=>{showPanel(false);select(n.id);nodeEls.get(n.id).scrollIntoView({block:'nearest',inline:'nearest'});});card.append(h,p,code,document.createElement('br'),b);findings.append(card);});
  const tabs=[document.getElementById('cg-map-tab'),document.getElementById('cg-findings-tab')];
  function showPanel(showFindings){tabs.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===Number(showFindings)));b.tabIndex=i===Number(showFindings)?0:-1;});document.getElementById('cg-map-panel').hidden=showFindings;document.getElementById('cg-findings-panel').hidden=!showFindings;}
  tabs.forEach((b,i)=>{b.addEventListener('click',()=>showPanel(!!i));b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;showPanel(!!next);tabs[next].focus();}});});
  const viewport=document.getElementById('cg-viewport');let zoom=1;
  function resize(){const width=Math.max(260,viewport.clientWidth-2)*zoom;svg.style.width=width+'px';svg.style.height=(width*graphHeight/2600)+'px';document.getElementById('cg-zoom').textContent=Math.round(zoom*100)+'%';}
  document.getElementById('cg-plus').onclick=()=>{zoom=Math.min(4,zoom+.25);resize();};document.getElementById('cg-minus').onclick=()=>{zoom=Math.max(.5,zoom-.25);resize();};document.getElementById('cg-fit').onclick=()=>{zoom=1;resize();viewport.scrollTo(0,0);};new ResizeObserver(resize).observe(viewport);resize();
  document.getElementById('cg-search').addEventListener('input',e=>{const q=e.target.value.trim().toLocaleLowerCase('vi');const matches=new Set(nodes.filter(n=>(n.label+' '+n.file+' '+n.issue).toLocaleLowerCase('vi').includes(q)).map(n=>n.id));nodeEls.forEach((g,id)=>g.classList.toggle('cg-muted',!!q&&!matches.has(id)));edgeEls.forEach(g=>g.classList.toggle('cg-muted',!!q&&!matches.has(g.dataset.from)&&!matches.has(g.dataset.to)));if(q&&matches.size===1)select([...matches][0]);document.getElementById('cg-zoom').textContent=q?matches.size+' node':Math.round(zoom*100)+'%';});
  document.getElementById('cg-export').onclick=()=>{const clone=svg.cloneNode(true);clone.removeAttribute('style');clone.setAttribute('width','2600');clone.setAttribute('height',String(graphHeight));clone.querySelectorAll('.cg-muted,.cg-selected').forEach(g=>g.classList.remove('cg-muted','cg-selected'));const bg=el('rect',{width:2600,height:graphHeight,fill:'#f1e6fd'});clone.insertBefore(bg,clone.firstChild);const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='homeland-codegraph.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const nav=document.createElement('div');nav.className='cg-controls';nav.setAttribute('aria-label','Đi tới nhóm code');
  groups.forEach(([id,title,x,y])=>{const b=document.createElement('button');b.textContent=title.split(' — ')[0];b.onclick=()=>{showPanel(false);requestAnimationFrame(()=>{resize();viewport.scrollTo({top:Math.max(0,(y-15)*svg.clientWidth/2600),left:x*svg.clientWidth/2600});});};nav.append(b);});
  viewport.before(nav);
  const summary=document.createElement('p');summary.className='cg-footnote';summary.textContent=nodes.length+' node · '+edges.length+' quan hệ · '+groups.length+' nhóm. Các node cùng hàng không mặc định nối nhau; chỉ đường có mũi tên mới biểu diễn quan hệ. Chọn Sales CRM / Settings để đi thẳng tới nhóm.';nav.before(summary);
  // Last shortcut in the existing toolbar; no .tab/data-filter so legacy filters keep their behavior.
  const shortcut=document.createElement('button');shortcut.className='cg-shortcut';shortcut.textContent='CodeGraph ↓';shortcut.setAttribute('aria-controls','codegraph');shortcut.onclick=()=>{showPanel(false);history.replaceState(null,'','#codegraph');root.scrollIntoView({block:'start'});tabs[0].focus({preventScroll:true});};document.querySelector('.toolbar').insertBefore(shortcut,document.getElementById('search'));
  if(location.hash==='#codegraph')requestAnimationFrame(()=>root.scrollIntoView({block:'start'}));
})();
