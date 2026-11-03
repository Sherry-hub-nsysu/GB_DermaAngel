// Autosave enhancements for distributor records and email workbench.
// Wrap the shared save path so every page reports browser-storage failures.
const originalLeadPersist = persist;
persist = function() {
  try { originalLeadPersist(); if (localStorage.getItem('da-leads') !== JSON.stringify(leads)) throw new Error('Storage write verification failed'); return true; }
  catch (error) { toast('經銷商資料未能儲存，請確認瀏覽器儲存空間後重試'); return false; }
};
function persistLeadRecord(lead) {
  try {
    const serialized = JSON.stringify(leads);
    localStorage.setItem('da-leads', serialized);
    if (localStorage.getItem('da-leads') !== serialized) throw new Error('Storage write verification failed');
    return true;
  } catch (error) {
    toast('資料無法儲存，請確認瀏覽器儲存空間');
    return false;
  }
}

showLeadInfo = function(company) {
  const lead = leads.find(item => item.company === company);
  if (!lead) return;
  if (!Array.isArray(lead.customFields)) lead.customFields = [];
  const field = (label, key, value, full = false, multiline = false) => `<label class="lead-edit-field${full ? ' full' : ''}">${esc(label)}${multiline
    ? `<textarea data-lead-field="${esc(key)}" rows="${key === 'timeline' || key === 'relatedBrands' || key === 'windowNotes' ? 3 : 2}">${esc(value || '')}</textarea>`
    : `<input data-lead-field="${esc(key)}" value="${esc(value || '')}"${key === 'company' || key === 'country' ? ' required' : ''}>`}</label>`;
  const customField = item => `<div class="lead-custom-field" data-custom-id="${esc(item.id)}"><label class="lead-edit-field">區塊名稱<input data-custom-label value="${esc(item.label || '')}" placeholder="例如：合作條件"></label><label class="lead-edit-field">內容<textarea data-custom-value rows="3" placeholder="輸入這個區塊的內容">${esc(item.value || '')}</textarea></label><button type="button" class="remove-custom-field" data-remove-custom="${esc(item.id)}" aria-label="刪除此區塊">移除區塊</button></div>`;
  const extras = (lead.emails || []).filter(email => email && email !== lead.email).join('\n');
  const content = $('#leadInfoContent');
  content.innerHTML = `<form class="lead-info-content" id="leadInfoEditForm"><div class="dialog-head"><div><span class="tiny-label">DISTRIBUTOR RECORD</span><h2>公司詳細資料</h2><p class="dialog-intro">修改會即時儲存於目前瀏覽器；也可以新增自己的資料區塊。</p></div><button type="button" class="close-dialog" id="closeLeadInfo" aria-label="關閉">×</button></div><div class="lead-info-controls"><label>開發階段<select data-lead-field="stage">${stages.map(stage => `<option ${lead.stage === stage ? 'selected' : ''}>${esc(stage)}</option>`).join('')}</select></label><label>下次跟進日期<input type="date" data-lead-field="followup" value="${esc(lead.followup || '')}"></label><label>經銷商類型<input data-lead-field="type" value="${esc(lead.type || '')}"></label></div><div class="lead-edit-grid">${field('公司名稱','company',lead.company)}${field('國家 / 市場','country',lead.country)}${field('聯絡人姓名','contact',lead.contact)}${field('職稱','title',lead.title)}${field('主要 Email','email',lead.email)}${field('其他 Email（每行一筆）','emailExtras',extras,true,true)}${field('電話 / WhatsApp','phone',lead.phone)}${field('公司網站','website',lead.website)}${field('社群 / LinkedIn','social',lead.social,true)}${field('最新聯絡進度','latestUpdate',lead.latestUpdate,true,true)}${field('原始接洽狀況','sourceStatus',lead.sourceStatus,true,true)}${field('相關品牌','relatedBrands',lead.relatedBrands,true,true)}${field('窗口資訊 / LinkedIn','windowNotes',lead.windowNotes,true,true)}${field('備註','remark',lead.remark,true,true)}${field('開發時間軸','timeline',lead.timeline,true,true)}${field('資料編號','sourceId',lead.sourceId)}${field('原始分類','sourceClass',lead.sourceClass)}</div><section class="lead-custom-section"><div class="lead-custom-heading"><div><h3>自訂資料區塊</h3><p>新增你需要記錄的欄位，名稱和內容都可以修改。</p></div><button type="button" class="outline" id="addLeadCustomField">＋ 新增區塊</button></div><div id="leadCustomFields">${lead.customFields.map(customField).join('')}</div></section><div class="lead-save-status" id="leadSaveStatus" role="status">已儲存</div><div class="dialog-actions"><button type="button" class="outline" id="closeLeadInfoBottom">關閉</button><button type="submit" class="primary" id="saveLeadInfo">儲存並完成</button></div></form>`;
  const dialog = $('#leadInfoDialog');
  if (!dialog.open) dialog.showModal();
  const form = $('#leadInfoEditForm');
  const status = $('#leadSaveStatus');
  let saveTimer;
  const collectAndSave = () => {
    const values = Object.fromEntries([...form.querySelectorAll('[data-lead-field]')].map(input => [input.dataset.leadField, input.value]));
    const duplicate = leads.find(item => item !== lead && item.company.trim().toLowerCase() === values.company.trim().toLowerCase() && marketList(item).some(market => marketList({country: values.country}).includes(market)));
    if (duplicate) { status.textContent = '同一國家已有相同公司名稱，請先調整'; status.classList.add('error'); return false; }
    status.classList.remove('error');
    Object.assign(lead, values);
    lead.company = values.company.trim();
    lead.country = values.country.trim();
    lead.email = values.email.trim();
    const extraEmails = values.emailExtras.split(/[;,\n]/).map(value => value.trim()).filter(Boolean);
    lead.emails = [...new Set([lead.email, ...extraEmails].filter(Boolean))];
    delete lead.emailExtras;
    lead.customFields = [...form.querySelectorAll('.lead-custom-field')].map(block => ({id:block.dataset.customId,label:block.querySelector('[data-custom-label]').value.trim(),value:block.querySelector('[data-custom-value]').value})).filter(item => item.label || item.value);
    status.textContent = persistLeadRecord(lead) ? '已自動儲存' : '儲存失敗，請重試';
    return true;
  };
  const closeAndRefresh = () => { clearTimeout(saveTimer); if (collectAndSave()) { persist(); dialog.close(); } };
  form.addEventListener('input', () => { status.textContent = '正在儲存…'; clearTimeout(saveTimer); saveTimer = setTimeout(collectAndSave, 450); });
  form.addEventListener('change', () => { clearTimeout(saveTimer); collectAndSave(); });
  form.addEventListener('submit', event => { event.preventDefault(); closeAndRefresh(); });
  $('#closeLeadInfo').onclick = $('#closeLeadInfoBottom').onclick = closeAndRefresh;
  form.addEventListener('click', event => {
    if (event.target.closest('#addLeadCustomField')) {
      const item = {id:`custom_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,label:'新資料區塊',value:''};
      lead.customFields.push(item);
      $('#leadCustomFields').insertAdjacentHTML('beforeend', customField(item));
      form.querySelector(`[data-custom-id="${item.id}"] [data-custom-label]`).focus();
      clearTimeout(saveTimer); collectAndSave();
    }
    const remove = event.target.closest('[data-remove-custom]');
    if (remove) { remove.closest('.lead-custom-field').remove(); clearTimeout(saveTimer); collectAndSave(); }
  });
  dialog.oncancel = event => { clearTimeout(saveTimer); if (collectAndSave()) persist(); };
};

// Keep the email composer and its generated draft after reloads.
const mailWorkFields = ['emailLead','mailBrand','mailSender','mailCompany','mailContact','mailRecipient','mailMarket','mailIntro','mailReason','followupContext','draftSubject','draftBody'];
const mailWorkKey = 'da-mail-workbench-state-v1';
const activeMailTypeKey = 'da-mail-active-template-v1';
try {
  const activeMailType = localStorage.getItem(activeMailTypeKey);
  if (activeMailType && mailTemplates[activeMailType]) { mailType = activeMailType; loadMailTemplate(); }
  const saved = JSON.parse(localStorage.getItem(mailWorkKey) || '{}');
  for (const id of mailWorkFields) {
    const el = document.getElementById(id);
    if (!el || saved[id] === undefined) continue;
    if (el.tagName === 'SELECT' && ![...el.options].some(option => option.value === saved[id])) continue;
    el.value = saved[id];
  }
} catch {}
let mailWorkTimer;
const saveMailWork = () => {
  const state = Object.fromEntries(mailWorkFields.map(id => [id, document.getElementById(id)?.value ?? '']));
  try { localStorage.setItem(mailWorkKey, JSON.stringify(state)); } catch { toast('郵件草稿無法儲存，請確認瀏覽器儲存空間'); }
};
$('#mailTemplateTabs')?.addEventListener('click', () => {
  try { localStorage.setItem(activeMailTypeKey, mailType); } catch {}
});
$('#mailTemplateTabs')?.addEventListener('click', () => clearTimeout(mailTemplateSaveTimer), {capture:true});
for (const id of mailWorkFields) {
  const el = document.getElementById(id);
  if (!el) continue;
  el.addEventListener('input', () => { clearTimeout(mailWorkTimer); mailWorkTimer = setTimeout(saveMailWork, 350); });
  el.addEventListener('change', () => { clearTimeout(mailWorkTimer); saveMailWork(); });
}
window.addEventListener('beforeunload', () => { clearTimeout(mailWorkTimer); saveMailWork(); });

// Template edits autosave as the user types; explicit save buttons remain available.
let mailTemplateSaveTimer;
for (const id of ['templateName','templateSubject','templateBody','templateIsFollowup']) {
  const el = document.getElementById(id);
  if (!el) continue;
  const save = () => {
    clearTimeout(mailTemplateSaveTimer);
    mailTemplateSaveTimer = setTimeout(() => {
      if (typeof saveCurrentMailTemplate === 'function') saveCurrentMailTemplate();
    }, 450);
  };
  el.addEventListener('input', save);
  el.addEventListener('change', () => { clearTimeout(mailTemplateSaveTimer); if (typeof saveCurrentMailTemplate === 'function') saveCurrentMailTemplate(); });
}
