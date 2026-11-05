
// The full navigation remains usable without JavaScript.
(() => {
  const toggle=document.querySelector('.mobile-menu-toggle'),sidebar=document.querySelector('.app-sidebar');
  if(!toggle||!sidebar)return;
  const mobile=matchMedia('(max-width:800px)');let open=false;
  function render(){toggle.hidden=!mobile.matches;toggle.setAttribute('aria-expanded',String(mobile.matches&&open));sidebar.classList.toggle('is-mobile-collapsed',mobile.matches&&!open);}
  toggle.addEventListener('click',()=>{open=!open;render();if(open)sidebar.querySelector('a')?.focus();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile.matches&&open){open=false;render();toggle.focus();}});
  sidebar.addEventListener('click',event=>{if(event.target.closest('a')&&mobile.matches){open=false;render();}});
  mobile.addEventListener('change',()=>{open=false;render();});render();
})();

function enhanceScrollableTables(root=document){
  for(const region of root.querySelectorAll('.list-scroll,.table-scroll')){
    if(region.dataset.scrollEnhanced)continue;region.dataset.scrollEnhanced='true';
    const hint=document.createElement('p');hint.className='scroll-hint';hint.textContent='Scroll horizontally to view all columns ↔';
    hint.id='table-scroll-hint-'+document.querySelectorAll('.scroll-hint').length;
    region.before(hint);region.tabIndex=0;region.setAttribute('role','region');
    if(!region.hasAttribute('aria-label'))region.setAttribute('aria-label','Scrollable table');
    region.setAttribute('aria-describedby',[region.getAttribute('aria-describedby'),hint.id].filter(Boolean).join(' '));
    const update=()=>{hint.hidden=region.scrollWidth<=region.clientWidth+1;};
    if('ResizeObserver' in window)new ResizeObserver(update).observe(region);else window.addEventListener('resize',update);
    document.fonts?.ready.then(update);update();
  }
}
enhanceScrollableTables();

const state = document.querySelector('[data-invoice-detail]');
if (state) {
const apiStatus = document.getElementById('api-status');
function textElement(tag, text, className) {
  const element = document.createElement(tag); element.textContent = text;
  if (className) element.className = className;
  return element;
}
function showUnavailable(message) {
  const panel = textElement('div', '', 'empty-document');
  const link = textElement('a', 'Back to invoices'); link.href = '/invoices';
  panel.append(textElement('h2', 'Invoice unavailable'), textElement('p', message), link);
  state.replaceChildren(panel);
}
function showInvoice(invoice) {
  const money = (cents, code = false) => new Intl.NumberFormat('en-US', {style:'currency',currency:invoice.currency,currencyDisplay:code?'code':'symbol'}).format(cents / 100);
  const date = value => new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value + 'T00:00:00Z'));
  const paper = textElement('article', '', 'invoice-document'); paper.dataset.invoiceId = invoice.id;
  const header = textElement('header', '', 'document-header');
  const company = textElement('div', '', 'document-company');
  const companyMark = document.createElement('img');companyMark.src='/assets/northline-mark.svg';companyMark.width=38;companyMark.height=38;companyMark.alt='';company.append(companyMark);
  const companyText = document.createElement('div');
  companyText.append(textElement('strong', invoice.from.name, 'wordmark'),textElement('p', invoice.from.description, 'company-note'));company.append(companyText);
  const title = textElement('div', '', 'document-title');
  const status = textElement('span', invoice.payment_status, 'payment-status');status.setAttribute('aria-label','Payment status: '+invoice.payment_status);
  title.append(textElement('h2','INVOICE'),status);header.append(company,title);paper.append(header);
  const meta = textElement('dl', '', 'invoice-meta');
  for (const [label,value] of [['Invoice number',invoice.invoice_number],['Issue date',date(invoice.issue_date)],['Due date',date(invoice.due_date)]]) {
    const field = document.createElement('div');if(label==='Invoice number')field.className='invoice-reference';field.append(textElement('dt',label),textElement('dd',value));meta.append(field);
  }
  paper.append(meta);
  const parties = textElement('div', '', 'parties');
  for (const [label,name,details] of [['From',invoice.from.name,invoice.from],['Bill to',invoice.customer,invoice.bill_to]]) {
    const party = textElement('section', '', 'party');
    party.append(textElement('h2',label,'section-label'),textElement('strong',name,label==='Bill to'?'bill-to-name':''));
    for (const line of [...details.address,details.email]) party.append(textElement('p',line));parties.append(party);
  }
  paper.append(parties);
  const scroll = textElement('div', '', 'table-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Invoice line items');
  const table=document.createElement('table'),columns=document.createElement('colgroup'),head=document.createElement('thead'),headRow=document.createElement('tr'),body=document.createElement('tbody');
  for(const name of ['description','quantity','price','amount'])columns.append(textElement('col','',name));
  for(const [index,label] of ['Description','Qty','Unit price','Amount'].entries()) {
    const cell=textElement('th',label,index?'numeric':'');cell.scope='col';headRow.append(cell);
  }
  head.append(headRow);
  for(const item of invoice.line_items) {
    const row=document.createElement('tr');
    for(const [index,value] of [item.description,String(item.quantity),money(item.unit_price_cents),money(item.amount_cents)].entries())row.append(textElement('td',value,index?'numeric':'item-description'));
    body.append(row);
  }
  table.append(columns,head,body);scroll.append(table);paper.append(scroll);
  const totals=textElement('div','','totals');
  const subtotal=textElement('div','','total-row');subtotal.append(textElement('span','Subtotal'),textElement('span',money(invoice.subtotal_cents,true)));
  const total=textElement('div','','total-row grand-total');
  const totalValue=textElement('strong',money(invoice.total_cents,true));totalValue.dataset.totalCents=invoice.total_cents;
  total.append(textElement('span','Amount due'),totalValue);totals.append(subtotal,total);
  const terms=textElement('section','','payment-terms');terms.append(textElement('h2','Payment terms','section-label'),textElement('p',invoice.payment_terms));
  const settlement=textElement('div','','invoice-settlement');settlement.append(terms,totals);paper.append(settlement);
  paper.append(textElement('footer',invoice.from.name+' · Fictional billing data.','document-footer'));
  state.replaceChildren(paper);enhanceScrollableTables(state);
}
async function loadInvoice() {
  try {
    const response = await fetch('/api/invoices/' + encodeURIComponent(state.dataset.invoiceId), {credentials:'same-origin',cache:'no-store'});
    const invoice = await response.json();
    apiStatus.textContent = response.status + (response.ok ? ' OK' : response.status===404 ? ' Not Found' : response.status===401 ? ' Unauthorized' : ' · API response');
    if (!response.ok) {
      showUnavailable(response.status === 401 ? 'Sign in to view this invoice.' : 'Not found or access denied.');
      return;
    }
    showInvoice(invoice);
  } catch (_) {
    apiStatus.textContent = 'Invoice retrieval failed';showUnavailable('The local API could not be reached.');
  }
}
loadInvoice();

}
