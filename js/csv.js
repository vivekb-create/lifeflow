// LifeFlow — CSV import / export
// CSV IMPORT / EXPORT
// ══════════════════════════════════════════════════════════════════════════════

// ── CSV Template definition ─────────────────────────────────────────────────
const CSV_HEADERS = ['Date','Description','Category','Amount','Notes'];
const CSV_DATE_FORMATS = ['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD','D/M/YY','DD-MM-YYYY'];

const CSV_TEMPLATE_ROWS = [
  ['15/01/2025','Grocery shopping','Food','450','Weekly groceries'],
  ['15/01/2025','Uber ride','Travel','180','Office commute'],
  ['16/01/2025','Amazon order','Shopping','1299','Phone cover'],
  ['16/01/2025','Gym membership','Health','999','Monthly fee'],
  ['17/01/2025','Electricity bill','Bills','2100','January bill'],
  ['17/01/2025','Movie tickets','Entertainment','600','Friday night'],
  ['18/01/2025','Lunch with team','Food','350','Team lunch'],
];

// ── Download blank template ──────────────────────────────────────────────────
function downloadCsvTemplate(){
  const lines = [
    '# LifeFlow Spending CSV Template',
    '# Format: ' + CSV_DATE_FORMATS.join(' | '),
    '# Amount: numbers only, no currency symbols (e.g. 450 not ₹450)',
    '# Category: use any name — new ones are created automatically',
    '# Notes column is optional',
    '',
    CSV_HEADERS.join(','),
    ...CSV_TEMPLATE_ROWS.map(r => r.map(cell =>
      cell.includes(',') ? '"' + cell + '"' : cell
    ).join(','))
  ];
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'lifeflow-spending-template.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('✅ Template downloaded! Fill it in and import it back.');
}

// ── Export all spends to CSV ─────────────────────────────────────────────────
function exportSpendCsv(){
  if(spends.length === 0){
    showToast('No transactions to export yet.');
    return;
  }
  const rows = [CSV_HEADERS.join(',')];
  const sorted = [...spends].sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  sorted.forEach(s => {
    const d = s.date ? new Date(s.date) : new Date();
    const dateStr = d.getDate().toString().padStart(2,'0') + '/' +
                    (d.getMonth()+1).toString().padStart(2,'0') + '/' +
                    d.getFullYear();
    const cells = [
      dateStr,
      '"' + (s.desc||'').replace(/"/g,'""') + '"',
      s.cat||'Other',
      s.amount.toString(),
      '"' + (s.notes||'').replace(/"/g,'""') + '"'
    ];
    rows.push(cells.join(','));
  });
  const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'lifeflow-spending-export-' + todayKey() + '.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📤 Exported ' + spends.length + ' transactions!');
}

// ── File input handler ──────────────────────────────────────────────────────
function handleCsvFile(e){
  const file = e.target.files[0];
  if(!file){ return; }
  if(!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv'){
    renderCsvError('Invalid file type. Please upload a .csv file.');
    e.target.value='';
    return;
  }
  if(file.size > 2 * 1024 * 1024){
    renderCsvError('File too large. Maximum size is 2 MB.');
    e.target.value='';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt){
    parseCsvAndPreview(evt.target.result, file.name);
    e.target.value=''; // reset so same file can be re-selected
  };
  reader.onerror = function(){
    renderCsvError('Could not read the file. Please try again.');
  };
  reader.readAsText(file, 'UTF-8');
}

// ── Parse CSV text ──────────────────────────────────────────────────────────
function parseCsvText(text){
  // Strip BOM if present
  if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
  const lines = text.split(/\r?\n/);
  const rows = [];
  let inQuote = false;
  let current = [];
  let cell = '';

  for(let li=0; li<lines.length; li++){
    const line = lines[li];
    // Skip comment lines (start with #) and empty lines
    if(line.trim().startsWith('#') || line.trim()==='') continue;

    for(let i=0; i<line.length; i++){
      const ch = line[i];
      if(inQuote){
        if(ch==='"'){
          if(line[i+1]==='"'){ cell+='"'; i++; }
          else inQuote=false;
        } else { cell+=ch; }
      } else {
        if(ch==='"'){ inQuote=true; }
        else if(ch===','){current.push(cell.trim());cell='';}
        else { cell+=ch; }
      }
    }
    if(!inQuote){
      current.push(cell.trim());
      cell='';
      if(current.some(c=>c!=='')) rows.push(current);
      current=[];
    } else {
      // Multi-line quoted field
      cell+='\n';
    }
  }
  return rows;
}

// ── Parse a date string in multiple formats ──────────────────────────────────
function parseCsvDate(str){
  if(!str) return null;
  str = str.trim();
  let d;

  // Try DD/MM/YYYY or DD-MM-YYYY
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(m){
    const day=parseInt(m[1]), mon=parseInt(m[2]), yr=parseInt(m[3]);
    const year = yr < 100 ? 2000+yr : yr;
    // Heuristic: if day>12, definitely DD/MM; else assume DD/MM
    d = new Date(year, mon-1, day);
    if(!isNaN(d.getTime())) return d;
  }
  // Try YYYY-MM-DD
  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if(m){
    d = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
    if(!isNaN(d.getTime())) return d;
  }
  // Try native parse as last resort
  d = new Date(str);
  if(!isNaN(d.getTime())) return d;
  return null;
}

// ── Normalise column header ──────────────────────────────────────────────────
function normaliseHeader(h){
  return h.toLowerCase().replace(/[^a-z]/g,'');
}

// ── Main: parse and show preview ─────────────────────────────────────────────
function parseCsvAndPreview(text, fileName){
  const el = document.getElementById('csv-import-area');
  if(!el) return;

  const allRows = parseCsvText(text);
  if(allRows.length < 2){
    renderCsvError('The file appears to be empty or has no data rows. Make sure it has a header row followed by data.');
    return;
  }

  // Identify header row
  const rawHeaders = allRows[0].map(h=>h.trim());
  const headerMap  = {};
  rawHeaders.forEach((h,i)=>{
    const norm = normaliseHeader(h);
    if(['date','dt'].includes(norm))           headerMap.date=i;
    if(['description','desc','details','name','narration','transaction','particulars'].includes(norm)) headerMap.desc=i;
    if(['category','cat','type','head'].includes(norm)) headerMap.cat=i;
    if(['amount','amt','debit','credit','sum','value','rs','inr','rupees'].includes(norm)) headerMap.amount=i;
    if(['notes','note','remarks','memo','comment'].includes(norm)) headerMap.notes=i;
  });

  // Check required headers
  // Date is now optional — if missing, all rows default to today
  const missing = [];
  if(headerMap.desc   === undefined) missing.push('Description');
  if(headerMap.amount === undefined) missing.push('Amount');

  if(missing.length > 0){
    renderCsvError(
      'Required columns not found: <strong>' + missing.join(', ') + '</strong>.<br>' +
      'Your file has columns: <em>' + rawHeaders.join(', ') + '</em>.<br>' +
      'Expected column names (case-insensitive): Date, Description, Amount. Category and Notes are optional.'
    );
    return;
  }

  // Parse data rows
  const dataRows = allRows.slice(1);
  const parsed   = [];
  const newCats  = new Set();
  const cats     = allCats();

  dataRows.forEach((row, i) => {
    const rowNum = i + 2; // 1-indexed, account for header
    const result = { rowNum, raw: row, errors: [], warnings: [], status: 'ok' };

    // Date — default to today if missing or invalid
    const dateRaw = row[headerMap.date] || '';
    const dateObj = parseCsvDate(dateRaw);
    if(!dateObj && dateRaw.trim() !== ''){
      result.warnings.push('Date "' + dateRaw + '" could not be parsed — defaulting to today.');
      result.date    = new Date();
      result.dateKey = todayKey();
    } else if(!dateObj){
      result.warnings.push('No date provided — defaulting to today.');
      result.date    = new Date();
      result.dateKey = todayKey();
    } else {
      result.date    = dateObj;
      result.dateKey = dateObj.getFullYear()+'-'+(dateObj.getMonth()+1)+'-'+dateObj.getDate();
    }

    // Description
    const desc = (row[headerMap.desc]||'').trim();
    if(!desc) result.errors.push('Description is empty.');
    result.desc = desc;

    // Amount
    const amtRaw = (row[headerMap.amount]||'').replace(/[₹$€£,\s]/g,'').trim();
    const amt    = parseFloat(amtRaw);
    if(isNaN(amt) || amt <= 0){
      result.errors.push('Amount "' + (row[headerMap.amount]||'') + '" is invalid. Use a positive number like 450.');
    } else if(amt > 10000000){
      result.warnings.push('Amount ₹' + amt.toLocaleString('en-IN') + ' is unusually large. Please verify.');
    }
    result.amount = isNaN(amt) ? 0 : Math.abs(amt);

    // Category — auto-create if new
    const catRaw = headerMap.cat !== undefined ? (row[headerMap.cat]||'').trim() : 'Other';
    const cat    = catRaw || 'Other';
    result.cat   = cat;
    if(!cats[cat]){
      newCats.add(cat);
      result.catIsNew = true;
      result.warnings.push('New category "' + cat + '" will be created automatically.');
    }

    // Notes (optional)
    result.notes = headerMap.notes !== undefined ? (row[headerMap.notes]||'').trim() : '';

    // Final status
    if(result.errors.length > 0)   result.status = 'error';
    else if(result.warnings.length > 0) result.status = 'warn';

    parsed.push(result);
  });

  const validRows   = parsed.filter(r=>r.status !== 'error');
  const errorRows   = parsed.filter(r=>r.status === 'error');
  const warnRows    = parsed.filter(r=>r.status === 'warn');
  const totalOk     = validRows.length;

  // Build preview HTML
  const previewRows = parsed.slice(0, 50); // show up to 50 rows
  const tableHtml = `
    <div class="csv-preview-scroll">
      <table class="csv-preview-table">
        <thead><tr>
          <th>Row</th><th>Date</th><th>Description</th><th>Category</th>
          <th>Amount</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${previewRows.map(r=>{
            const statusLabel = r.status==='error'
              ? '<span class="csv-row-status error">Error</span>'
              : r.catIsNew
              ? '<span class="csv-row-status new-cat">New cat</span>'
              : r.status==='warn'
              ? '<span class="csv-row-status warn">Warning</span>'
              : '<span class="csv-row-status ok">OK</span>';
            const issues = [...(r.errors||[]),...(r.warnings||[])].join(' | ');
            const dateStr = r.date
              ? r.date.getDate()+'/'+(r.date.getMonth()+1)+'/'+r.date.getFullYear()
              : '<span style="color:var(--red)">'+( r.raw[0]||'—')+'</span>';
            return `<tr class="row-${r.status}" title="${issues}">
              <td style="color:var(--text3)">${r.rowNum}</td>
              <td>${dateStr}</td>
              <td>${r.desc||'<span style="color:var(--red)">Empty</span>'}</td>
              <td>${r.catIsNew?'<span style="color:var(--blue)">'+r.cat+' ✦</span>':r.cat}</td>
              <td>${r.amount>0?'₹'+r.amount.toLocaleString('en-IN'):'<span style="color:var(--red)">Invalid</span>'}</td>
              <td>${statusLabel}${issues?'<div style="font-size:10px;color:var(--text3);margin-top:2px">'+issues+'</div>':''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  // Summary bar
  let summaryHtml = '';
  if(errorRows.length === 0 && warnRows.length === 0){
    summaryHtml = `<div class="csv-summary-bar success">
      ✅ <strong>All ${totalOk} rows are valid</strong> and ready to import.
      ${newCats.size>0?'<br>✦ '+newCats.size+' new categor'+(newCats.size>1?'ies':'y')+' will be created: <strong>'+[...newCats].join(', ')+'</strong>':''}
    </div>`;
  } else if(totalOk > 0){
    summaryHtml = `<div class="csv-summary-bar partial">
      ⚠️ <strong>${totalOk} of ${parsed.length} rows</strong> will be imported.
      ${errorRows.length>0?'<strong>'+errorRows.length+' row'+(errorRows.length>1?'s have':'has')+' errors</strong> (shown in red) and will be skipped. ':''}
      ${warnRows.length>0?warnRows.length+' row'+(warnRows.length>1?'s have':'has')+' warnings (shown in yellow). ':''}
      ${newCats.size>0?'<br>✦ New categories will be created: <strong>'+[...newCats].join(', ')+'</strong>':''}
    </div>`;
  } else {
    summaryHtml = `<div class="csv-summary-bar error">
      ❌ <strong>All ${parsed.length} rows have errors</strong> — nothing can be imported.
      Please fix the errors and try again, or download the template to see the correct format.
    </div>`;
  }

  el.innerHTML = `
    <div style="margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:13px;font-weight:500;color:var(--text)">
          Preview: <em style="color:var(--text3)">${fileName}</em>
          <span style="color:var(--text3);font-weight:400"> — ${parsed.length} row${parsed.length!==1?'s':''}</span>
        </div>
        <button class="del" onclick="clearCsvPreview()" title="Clear preview">×</button>
      </div>
      ${summaryHtml}
      ${tableHtml}
      ${parsed.length>50?'<div style="font-size:11px;color:var(--text3);margin-top:6px">Showing first 50 rows. All '+ parsed.length +' rows will be processed on import.</div>':''}
      <div class="csv-field-hint">
        ✦ = new category &nbsp;|&nbsp; Hover over rows to see details &nbsp;|&nbsp;
        Dates accepted: ${CSV_DATE_FORMATS.join(', ')}
      </div>
      ${totalOk>0?`
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" onclick="confirmCsvImport()" id="csv-confirm-btn">
          Import ${totalOk} transaction${totalOk!==1?'s':''}
        </button>
        <button class="btn btn-ghost" onclick="clearCsvPreview()">Cancel</button>
      </div>`:'<div style="margin-top:10px"><button class="btn btn-ghost" onclick="clearCsvPreview()">Close</button></div>'}
    </div>`;

  // Store parsed data for confirm
  window._csvParsed = parsed;
  window._csvNewCats = [...newCats];
}

// ── Confirm and execute import ───────────────────────────────────────────────
function confirmCsvImport(){
  const btn = document.getElementById('csv-confirm-btn');
  if(btn){ btn.textContent='Importing...'; btn.disabled=true; }

  const parsed   = window._csvParsed || [];
  const newCatNames = window._csvNewCats || [];
  const cats     = allCats();

  // 1. Auto-create missing categories
  const palette = ['#6B8F71','#B8845A','#5A78B8','#B85A4A','#8A6BC4','#5A9898','#9E6B9E','#9E8A6B'];
  newCatNames.forEach((name, i) => {
    if(!cats[name]){
      const color = palette[i % palette.length];
      customCats.push({name, emoji:'🏷️', color, bg: color+'22'});
    }
  });

  // 2. Import valid rows
  let imported = 0;
  parsed.forEach(r => {
    if(r.status === 'error') return;
    spends.push({
      id:    uid(),
      cat:   r.cat || 'Other',
      desc:  r.desc,
      amount:r.amount,
      date:  r.dateKey || todayKey(),
      notes: r.notes || ''
    });
    imported++;
  });

  persistSpend();
  clearCsvPreview();
  renderPersonal();

  const newCatMsg = newCatNames.length > 0
    ? ' Created ' + newCatNames.length + ' new categor' + (newCatNames.length>1?'ies':'y') + ': ' + newCatNames.join(', ') + '.'
    : '';
  showToast('✅ Imported ' + imported + ' transaction' + (imported!==1?'s':'')+'.'+newCatMsg);
}

function clearCsvPreview(){
  const el = document.getElementById('csv-import-area');
  if(el) el.innerHTML='';
  window._csvParsed  = null;
  window._csvNewCats = null;
}

function renderCsvError(msg){
  const el = document.getElementById('csv-import-area');
  if(!el) return;
  el.innerHTML = `
    <div class="csv-summary-bar error" style="margin-top:10px">
      ❌ <strong>Import failed</strong><br>${msg}
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="csv-btn download" onclick="downloadCsvTemplate()">⬇ Download Template</button>
      <button class="btn btn-ghost btn-sm" onclick="clearCsvPreview()">Close</button>
    </div>`;
}


// ════════════════════════════════════════════════════════════════════════════
