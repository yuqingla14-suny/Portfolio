const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const authPanel = $('#authPanel');
const dashboard = $('#dashboard');
const authForm = $('#authForm');
const statusMessage = $('#statusMessage');
let content;
let setupMode = false;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function lines(value) { return (Array.isArray(value) ? value : []).join('\n'); }
function field(label, name, value, options = {}) {
  const className = options.wide ? 'wide' : '';
  if (options.select) {
    const choices = options.select.map(([key, text]) => `<option value="${key}" ${value === key ? 'selected' : ''}>${text}</option>`).join('');
    return `<label class="${className}">${label}<select name="${name}">${choices}</select></label>`;
  }
  const control = options.multiline
    ? `<textarea name="${name}" rows="${options.rows || 4}">${escapeHtml(value)}</textarea>`
    : `<input name="${name}" value="${escapeHtml(value)}" ${options.type ? `type="${options.type}"` : ''}>`;
  return `<label class="${className}">${label}${control}</label>`;
}
function imageList(images = []) {
  return `<ul class="image-list">${images.map((src, index) => `<li class="image-item"><img src="../${escapeHtml(src)}" alt="已上傳的作品圖片"><button type="button" data-remove-image="${index}" aria-label="移除圖片">×</button></li>`).join('')}</ul>`;
}
function cardMarkup(kind, item, index) {
  const names = { gallery: '精選作品', projects: '專案作品', articles: '文章' };
  const images = kind === 'articles' ? (item.image ? [item.image] : []) : (item.images || []);
  const uploadText = kind === 'articles' ? '上傳文章圖片' : '上傳圖片（可多選）';
  let fields = '';
  if (kind === 'gallery') {
    fields = field('作品中文標題','title',item.title) + field('作品英文標題','englishTitle',item.englishTitle)
      + field('作品類型','type',item.type,{select:[['video','影片'],['photo','照片'],['design','平面設計'],['painting','繪畫']]})
      + field('媒介／小標籤','medium',item.medium) + field('作品內文','description',item.description,{multiline:true,wide:true,rows:4})
      + field('YouTube 內嵌連結（影片作品）','videoUrl',item.videoUrl || '',{wide:true});
  } else if (kind === 'projects') {
    fields = field('作品中文標題','title',item.title) + field('作品英文標題','englishTitle',item.englishTitle)
      + field('標籤（每行一個）','tags',lines(item.tags),{multiline:true,rows:2}) + field('年份','year',item.year)
      + field('作品介紹','description',item.description,{multiline:true,wide:true,rows:5})
      + `<label class="checkbox-field wide"><input type="checkbox" name="visible" ${item.visible !== false ? 'checked' : ''}>顯示於首頁專案區</label>`;
  } else {
    fields = field('文章標題','title',item.title) + field('文章副標題','subtitle',item.subtitle)
      + field('日期','date',item.date) + field('分類','category',item.category)
      + field('列表摘要','summary',item.summary,{wide:true})
      + field('文章內文','content',item.content,{multiline:true,wide:true,rows:8});
  }
  const heading = item.title || `${names[kind]} ${index + 1}`;
  return `<article class="editor-card" data-kind="${kind}" data-id="${escapeHtml(item.id)}" data-images="${escapeHtml(JSON.stringify(images))}">
    <div class="card-top"><h3>${escapeHtml(heading)}</h3><button class="remove-button" type="button" data-remove-card>刪除此${names[kind]}</button></div>
    <div class="card-fields">${fields}</div>
    <div class="image-tools"><label class="button secondary upload-button">${uploadText}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" ${kind === 'articles' ? '' : 'multiple'} hidden data-upload></label>${imageList(images)}</div>
  </article>`;
}
function render() {
  $('#aboutName').value = content.about.name || '';
  $('#announcement').value = content.about.announcement || '';
  $('#aboutLabels').value = lines(content.about.labels);
  $('#aboutHashtags').value = lines(content.about.hashtags);
  $('#aboutBio').value = content.about.bio || '';
  for (const kind of ['gallery', 'projects', 'articles']) {
    const holder = $(`#${kind === 'gallery' ? 'galleryCards' : kind === 'projects' ? 'projectCards' : 'articleCards'}`);
    holder.innerHTML = content[kind].map((item, index) => cardMarkup(kind, item, index)).join('') || '<p class="muted">目前沒有內容，按右上方按鈕新增。</p>';
  }
}
function collect() {
  const next = structuredClone(content);
  next.about.name = $('#aboutName').value.trim();
  next.about.announcement = $('#announcement').value.trim();
  next.about.labels = $('#aboutLabels').value.split('\n').map((value) => value.trim()).filter(Boolean);
  next.about.hashtags = $('#aboutHashtags').value.split('\n').map((value) => value.trim().replace(/^#\s*/, '')).filter(Boolean);
  next.about.bio = $('#aboutBio').value.trim();
  for (const kind of ['gallery', 'projects', 'articles']) {
    next[kind] = $$(`.editor-card[data-kind="${kind}"]`).map((card) => {
      const item = { id: card.dataset.id };
      const values = Object.fromEntries($$('input[name],textarea[name],select[name]', card).map((node) => [node.name, node.type === 'checkbox' ? node.checked : node.value.trim()]));
      Object.assign(item, values);
      const images = JSON.parse(card.dataset.images || '[]');
      if (kind === 'gallery') { item.images = images; }
      if (kind === 'projects') { item.images = images; item.tags = (values.tags || '').split('\n').map((v) => v.trim()).filter(Boolean); }
      if (kind === 'articles') { item.image = images[0] || ''; }
      return item;
    });
  }
  return next;
}
function setStatus(message, error = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('error', error);
  if (message) setTimeout(() => { if (statusMessage.textContent === message) statusMessage.textContent = ''; }, 4500);
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '連線失敗，請稍後再試。');
  return result;
}
async function showDashboard() {
  authPanel.hidden = true;
  dashboard.hidden = false;
  content = await api('/api/content');
  render();
}
function showAuth(configured) {
  setupMode = !configured;
  authPanel.hidden = false;
  dashboard.hidden = true;
  $('#authTitle').textContent = setupMode ? '建立管理帳號' : '登入後台';
  $('#authHelp').textContent = setupMode ? '設定專屬帳號與密碼，完成後即可管理作品集。' : '請使用管理員帳號登入。';
  $('#authSubmit').textContent = setupMode ? '建立帳號並登入' : '登入';
  $('#confirmPasswordRow').hidden = !setupMode;
  authForm.elements.password.autocomplete = setupMode ? 'new-password' : 'current-password';
  authForm.elements.password.minLength = setupMode ? 12 : 1;
  authForm.elements.confirmPassword.required = setupMode;
}

async function start() {
  try {
    const session = await api('/api/session');
    if (session.authenticated) await showDashboard();
    else showAuth(session.configured);
  } catch (error) {
    authPanel.hidden = false;
    $('#authTitle').textContent = '無法連接後台服務';
    $('#authHelp').textContent = '請先在專案資料夾啟動 Node 服務，再重新整理此頁。';
    authForm.hidden = true;
    $('#authError').textContent = error.message;
  }
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = authForm.elements.username.value.trim();
  const password = authForm.elements.password.value;
  $('#authError').textContent = '';
  try {
    if (setupMode && password !== authForm.elements.confirmPassword.value) throw new Error('兩次輸入的密碼不一致。');
    await api(setupMode ? '/api/setup' : '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    await showDashboard();
  } catch (error) { $('#authError').textContent = error.message; }
});

$('#saveButton').addEventListener('click', async () => {
  const button = $('#saveButton');
  button.disabled = true;
  button.textContent = '正在儲存…';
  try {
    content = collect();
    await api('/api/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
    setStatus('已儲存，重新整理網站即可看到更新。');
  } catch (error) { setStatus(error.message, true); }
  finally { button.disabled = false; button.textContent = '儲存並更新網站'; }
});

$$('[data-add]').forEach((button) => button.addEventListener('click', () => {
  content = collect();
  const kind = button.dataset.add;
  const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
  const defaults = kind === 'gallery'
    ? { id, type: 'photo', title: '', englishTitle: '', medium: '', description: '', images: [] }
    : kind === 'projects'
      ? { id, title: '', englishTitle: '', tags: [], year: '', description: '', images: [], visible: true }
      : { id, title: '', subtitle: '', date: '', category: '文章', summary: '', content: '', image: '' };
  content[kind].push(defaults);
  render();
  $(`#${kind === 'gallery' ? 'galleryCards' : kind === 'projects' ? 'projectCards' : 'articleCards'} .editor-card:last-child`).scrollIntoView({ behavior: 'smooth', block: 'center' });
}));

$$('.card-list').forEach((holder) => holder.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove-card]');
  const removeImage = event.target.closest('[data-remove-image]');
  if (remove) {
    content = collect();
    const card = remove.closest('.editor-card');
    content[card.dataset.kind] = content[card.dataset.kind].filter((item) => item.id !== card.dataset.id);
    render();
  }
  if (removeImage) {
    const card = removeImage.closest('.editor-card');
    const images = JSON.parse(card.dataset.images || '[]');
    images.splice(Number(removeImage.dataset.removeImage), 1);
    card.dataset.images = JSON.stringify(images);
    card.querySelector('.image-list').outerHTML = imageList(images);
  }
}));

$$('[data-upload]').forEach((input) => input.addEventListener('change', async () => {
  if (!input.files.length) return;
  const card = input.closest('.editor-card');
  const form = new FormData();
  [...input.files].forEach((file) => form.append('images', file));
  input.disabled = true;
  try {
    const result = await api('/api/upload', { method: 'POST', body: form });
    const images = JSON.parse(card.dataset.images || '[]');
    card.dataset.images = JSON.stringify([...images, ...result.files]);
    card.querySelector('.image-list').outerHTML = imageList([...images, ...result.files]);
    setStatus(`已上傳 ${result.files.length} 張圖片，請記得儲存內容。`);
  } catch (error) { setStatus(error.message, true); }
  finally { input.disabled = false; input.value = ''; }
}));

$('#logoutButton').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  showAuth(true);
});

start();
