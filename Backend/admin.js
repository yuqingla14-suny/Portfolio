const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const authPanel = $('#authPanel');
const dashboard = $('#dashboard');
const authForm = $('#authForm');
const statusMessage = $('#statusMessage');
let content;
let setupMode = false;
let githubMode = false;
const REPOSITORY_OWNER = 'yuqingla14-suny';
const REPOSITORY_NAME = 'Portfolio';
const REPOSITORY_BRANCH = 'main';
const CONTENT_PATH = 'Backend/data/site-content.json';
const GITHUB_TOKEN_KEY = 'sunny-portfolio-github-token';

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
function articleSectionMarkup(section = {}, index = 0) {
  return `<div class="article-section-editor" data-article-section>
    <div class="article-section-editor-heading"><strong>文章段落 ${index + 1}</strong><button class="remove-button" type="button" data-remove-section>移除此段</button></div>
    ${field('小標題（可留空）','sectionHeading',section.heading || '')}
    ${field('內文','sectionBody',section.body || '',{multiline:true,wide:true,rows:5})}
  </div>`;
}
function cardMarkup(kind, item, index) {
  const names = { gallery: '精選作品', projects: '專案作品', articles: '文章' };
  const images = kind === 'articles' ? (item.images || (item.image ? [item.image] : [])) : (item.images || []);
  const uploadText = kind === 'articles' ? '上傳文章圖片（可多選）' : '上傳圖片（可多選）';
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
      + `<div class="article-sections wide"><div class="article-sections-heading"><strong>文章段落</strong><button class="button light" type="button" data-add-section>＋ 新增小標題與內文</button></div><div class="article-sections-list">${(item.sections || (item.content ? [{ heading: '', body: item.content }] : [{ heading: '', body: '' }])).map((section, sectionIndex) => articleSectionMarkup(section, sectionIndex)).join('')}</div></div>`;
  }
  const heading = item.title || `${names[kind]} ${index + 1}`;
  return `<article class="editor-card" data-kind="${kind}" data-id="${escapeHtml(item.id)}" data-images="${escapeHtml(JSON.stringify(images))}">
    <div class="card-top"><h3>${escapeHtml(heading)}</h3><button class="remove-button" type="button" data-remove-card>刪除此${names[kind]}</button></div>
    <div class="card-fields">${fields}</div>
    <div class="image-tools"><label class="button secondary upload-button">${uploadText}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden data-upload></label>${imageList(images)}</div>
  </article>`;
}
function render() {
  $('#aboutName').value = content.about.name || '';
  $('#announcement').value = content.about.announcement || '';
  $('#aboutLabels').value = lines(content.about.labels);
  $('#aboutHashtags').value = lines(content.about.hashtags);
  $('#aboutBio').value = content.about.bio || '';
  const aboutImages = content.about.highlights || [];
  const highlightEditor = $('#aboutHighlightImages');
  highlightEditor.dataset.images = JSON.stringify(aboutImages);
  highlightEditor.querySelector('.image-list').outerHTML = imageList(aboutImages);
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
  next.about.highlights = JSON.parse($('#aboutHighlightImages').dataset.images || '[]');
  for (const kind of ['gallery', 'projects', 'articles']) {
    next[kind] = $$(`.editor-card[data-kind="${kind}"]`).map((card) => {
      const item = { id: card.dataset.id };
      const formControls = $$('input[name],textarea[name],select[name]', card).filter((node) => !node.closest('[data-article-section]'));
      const values = Object.fromEntries(formControls.map((node) => [node.name, node.type === 'checkbox' ? node.checked : node.value.trim()]));
      Object.assign(item, values);
      const images = JSON.parse(card.dataset.images || '[]');
      if (kind === 'gallery') { item.images = images; }
      if (kind === 'projects') { item.images = images; item.tags = (values.tags || '').split('\n').map((v) => v.trim()).filter(Boolean); }
      if (kind === 'articles') {
        item.images = images;
        item.sections = $$('[data-article-section]', card).map((section) => ({
          heading: $('[name="sectionHeading"]', section).value.trim(),
          body: $('[name="sectionBody"]', section).value.trim()
        }));
      }
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
function githubHeaders(token = sessionStorage.getItem(GITHUB_TOKEN_KEY)) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}
function githubFileUrl(filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}/contents/${encodedPath}`;
}
async function githubRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...githubHeaders(), ...options.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('GitHub 權杖無效或沒有此儲存庫的 Contents 讀寫權限。');
    if (response.status === 404) throw new Error('找不到 GitHub 檔案或儲存庫，請確認儲存庫名稱與 main 分支。');
    throw new Error(result.message || `GitHub 回應錯誤（${response.status}）。`);
  }
  return result;
}
async function githubReadFile(filePath) {
  const result = await githubRequest(`${githubFileUrl(filePath)}?ref=${encodeURIComponent(REPOSITORY_BRANCH)}`);
  const binary = atob(result.content.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return { sha: result.sha, text: new TextDecoder().decode(bytes) };
}
function base64FromBytes(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
async function githubWriteFile(filePath, contentBase64, message) {
  let sha;
  try { sha = (await githubReadFile(filePath)).sha; }
  catch (error) { if (!error.message.startsWith('找不到 GitHub 檔案')) throw error; }
  const payload = { message, content: contentBase64, branch: REPOSITORY_BRANCH };
  if (sha) payload.sha = sha;
  return githubRequest(githubFileUrl(filePath), { method: 'PUT', body: JSON.stringify(payload) });
}
function showGitHubAuth(errorMessage = '') {
  githubMode = true;
  setupMode = false;
  authPanel.hidden = false;
  dashboard.hidden = true;
  $('#authTitle').textContent = '連結 GitHub 管理後台';
  $('#authHelp').textContent = `後台將更新 ${REPOSITORY_OWNER}/${REPOSITORY_NAME} 的 main 分支。請輸入只授權此儲存庫 Contents 讀寫權限的 Fine-grained personal access token。`;
  $('#authSecurityNote').innerHTML = '權杖只保留在目前瀏覽器分頁，登出或關閉分頁後即清除。<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">建立 Fine-grained token</a>';
  $('#authSubmit').textContent = '登入並載入網站內容';
  $('#confirmPasswordRow').hidden = true;
  const usernameLabel = authForm.elements.username.closest('label');
  usernameLabel.childNodes[0].textContent = 'GitHub 帳號';
  authForm.elements.username.value = REPOSITORY_OWNER;
  authForm.elements.username.readOnly = true;
  const tokenLabel = authForm.elements.password.closest('label');
  tokenLabel.childNodes[0].textContent = 'GitHub 權杖';
  authForm.elements.password.value = '';
  authForm.elements.password.placeholder = 'github_pat_…';
  authForm.elements.password.minLength = 20;
  $('#authError').textContent = errorMessage;
  authForm.hidden = false;
}
async function showDashboard() {
  let loadedContent;
  if (githubMode) {
    const file = await githubReadFile(CONTENT_PATH);
    try { loadedContent = JSON.parse(file.text); }
    catch { throw new Error('GitHub 上的網站資料格式錯誤，請先修復 Backend/data/site-content.json。'); }
  } else {
    loadedContent = await api('/api/content');
  }
  if (!loadedContent?.about || !Array.isArray(loadedContent.gallery) || !Array.isArray(loadedContent.projects) || !Array.isArray(loadedContent.articles)) {
    throw new Error('網站資料缺少必要欄位，請確認 Backend/data/site-content.json。');
  }
  content = loadedContent;
  render();
  authPanel.hidden = true;
  dashboard.hidden = false;
  $('#saveButton').textContent = githubMode ? '提交更新到 GitHub' : '儲存並更新網站';
}
function showAuth(configured) {
  setupMode = !configured;
  githubMode = false;
  authPanel.hidden = false;
  dashboard.hidden = true;
  $('#authTitle').textContent = setupMode ? '建立管理帳號' : '登入後台';
  $('#authHelp').textContent = setupMode ? '設定專屬帳號與密碼，完成後即可管理作品集。' : '請使用管理員帳號登入。';
  $('#authSubmit').textContent = setupMode ? '建立帳號並登入' : '登入';
  $('#confirmPasswordRow').hidden = !setupMode;
  $('#authSecurityNote').textContent = '首次使用請建立管理帳號。密碼會以雜湊形式儲存在本機。';
  authForm.elements.password.autocomplete = setupMode ? 'new-password' : 'current-password';
  authForm.elements.password.minLength = setupMode ? 12 : 1;
  authForm.elements.confirmPassword.required = setupMode;
}

async function start() {
  const isLocalServer = ['127.0.0.1', 'localhost'].includes(location.hostname) && location.port === '4173';
  if (!isLocalServer) {
    githubMode = true;
    const token = sessionStorage.getItem(GITHUB_TOKEN_KEY);
    if (token) {
      try { await showDashboard(); return; }
      catch (error) { sessionStorage.removeItem(GITHUB_TOKEN_KEY); showGitHubAuth(error.message); return; }
    }
    showGitHubAuth();
    return;
  }
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
    if (githubMode) {
      sessionStorage.setItem(GITHUB_TOKEN_KEY, password);
      await githubReadFile(CONTENT_PATH);
      await showDashboard();
      return;
    }
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
    if (githubMode) {
      await githubWriteFile(CONTENT_PATH, base64FromBytes(new TextEncoder().encode(`${JSON.stringify(content, null, 2)}\n`)), '更新作品集網站內容');
      setStatus('內容已提交到 GitHub。GitHub Pages 部署完成後，網站就會顯示更新。');
    } else {
      await api('/api/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
      setStatus('已儲存，重新整理網站即可看到更新。');
    }
  } catch (error) { setStatus(error.message, true); }
  finally { button.disabled = false; button.textContent = githubMode ? '提交更新到 GitHub' : '儲存並更新網站'; }
});

$$('[data-add]').forEach((button) => button.addEventListener('click', () => {
  content = collect();
  const kind = button.dataset.add;
  const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
  const defaults = kind === 'gallery'
    ? { id, type: 'photo', title: '', englishTitle: '', medium: '', description: '', images: [] }
    : kind === 'projects'
      ? { id, title: '', englishTitle: '', tags: [], year: '', description: '', images: [], visible: true }
      : { id, title: '', subtitle: '', date: '', category: '文章', summary: '', sections: [{ heading: '', body: '' }], images: [] };
  content[kind].push(defaults);
  render();
  $(`#${kind === 'gallery' ? 'galleryCards' : kind === 'projects' ? 'projectCards' : 'articleCards'} .editor-card:last-child`).scrollIntoView({ behavior: 'smooth', block: 'center' });
}));

$$('.card-list').forEach((holder) => holder.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove-card]');
  const removeImage = event.target.closest('[data-remove-image]');
  const addSection = event.target.closest('[data-add-section]');
  const removeSection = event.target.closest('[data-remove-section]');
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
  if (addSection) {
    const card = addSection.closest('.editor-card');
    const list = card.querySelector('.article-sections-list');
    list.insertAdjacentHTML('beforeend', articleSectionMarkup({}, list.querySelectorAll('[data-article-section]').length));
  }
  if (removeSection) {
    const section = removeSection.closest('[data-article-section]');
    const list = section.parentElement;
    section.remove();
    list.querySelectorAll('[data-article-section]').forEach((item, index) => { item.querySelector('strong').textContent = `文章段落 ${index + 1}`; });
  }
}));

$('#aboutHighlightImages').addEventListener('click', (event) => {
  const removeImage = event.target.closest('[data-remove-image]');
  if (!removeImage) return;
  const editor = $('#aboutHighlightImages');
  const images = JSON.parse(editor.dataset.images || '[]');
  images.splice(Number(removeImage.dataset.removeImage), 1);
  editor.dataset.images = JSON.stringify(images);
  editor.querySelector('.image-list').outerHTML = imageList(images);
});

$$('[data-upload]').forEach((input) => input.addEventListener('change', async () => {
  if (!input.files.length) return;
  const card = input.closest('.editor-card') || input.closest('[data-image-owner]');
  const form = new FormData();
  [...input.files].forEach((file) => form.append('images', file));
  input.disabled = true;
  try {
    let uploadedFiles;
    if (githubMode) {
      uploadedFiles = [];
      for (const file of [...input.files]) {
        const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 12)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await githubWriteFile(`images/uploads/${fileName}`, base64FromBytes(bytes), `上傳作品圖片 ${fileName}`);
        uploadedFiles.push(`images/uploads/${fileName}`);
      }
    } else {
      const result = await api('/api/upload', { method: 'POST', body: form });
      uploadedFiles = result.files;
    }
    const images = JSON.parse(card.dataset.images || '[]');
    card.dataset.images = JSON.stringify([...images, ...uploadedFiles]);
    card.querySelector('.image-list').outerHTML = imageList([...images, ...uploadedFiles]);
    setStatus(githubMode ? `已提交 ${uploadedFiles.length} 張圖片到 GitHub；編輯完成後請再提交內容。` : `已上傳 ${uploadedFiles.length} 張圖片，請記得儲存內容。`);
  } catch (error) { setStatus(error.message, true); }
  finally { input.disabled = false; input.value = ''; }
}));

$('#logoutButton').addEventListener('click', async () => {
  if (githubMode) {
    sessionStorage.removeItem(GITHUB_TOKEN_KEY);
    showGitHubAuth();
  } else {
    await api('/api/logout', { method: 'POST' });
    showAuth(true);
  }
});

start();
