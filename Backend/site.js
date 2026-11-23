(() => {
  const pathname = location.pathname;
  const nested = pathname.includes('/projects/');
  const rootPrefix = nested ? '../' : '';
  const asset = (value) => /^(https?:|data:|\/)/.test(value || '') ? value : `${rootPrefix}${value || ''}`;
  const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);
  const categoryNames = { video:'影片', photo:'照片', design:'平面設計', painting:'繪畫' };
  const pickThree = (items) => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    return new Set(shuffled.slice(0, 3));
  };
  const textWithBreaks = (element, value) => {
    if (!element) return;
    element.replaceChildren();
    String(value || '').split('\n').forEach((line, index) => { if (index) element.append(document.createElement('br')); element.append(document.createTextNode(line)); });
  };
  async function loadContent() {
    try {
      const response = await fetch('/api/content', { cache: 'no-store' });
      if (response.ok) return await response.json();
    } catch {}
    try {
      const response = await fetch(`${rootPrefix}Backend/data/site-content.json`, { cache: 'no-store' });
      if (response.ok) return await response.json();
    } catch {}
    return null;
  }
  function renderAbout(data) {
    const name = document.querySelector('.name-title');
    if (name && data.name) {
      name.replaceChildren();
      const parts = data.name.trim().split(/\s+/);
      name.append(document.createTextNode(parts.shift() || ''));
      if (parts.length) { name.append(document.createTextNode(' ')); const span = document.createElement('span'); span.textContent = parts.join(' '); name.append(span); }
    }
    const labels = [...document.querySelectorAll('.portrait-label')];
    labels.forEach((label, index) => { if (data.labels?.[index]) { label.textContent = data.labels[index]; label.hidden = false; } else label.hidden = true; });
    const hashtags = document.querySelector('.about-hashtags');
    if (hashtags && data.hashtags) hashtags.innerHTML = data.hashtags.map((text) => `<li># ${esc(text)}</li>`).join('');
    const bio = document.querySelector('.bio');
    if (bio) textWithBreaks(bio, data.bio);
    const announcement = document.querySelector('.highlight-announcement p');
    if (announcement && data.announcement) announcement.textContent = data.announcement;
  }
  function renderGallery(items) {
    const grid = document.querySelector('#galleryGrid');
    if (!grid || !Array.isArray(items)) return;
    grid.innerHTML = items.map((item, index) => {
      const first = item.images?.[0] || '';
      const isVideo = item.type === 'video' && item.videoUrl;
      const target = isVideo ? `data-artwork-type="video" data-artwork-video="${esc(item.videoUrl)}"` : `data-artwork-type="image" data-artwork-src="${esc(asset(first))}"`;
      return `<a class="gallery-photo photo-${['one','two','three','four','five','six'][index % 6]}" data-category="${esc(item.type)}" href="#galleryArtworkModal" data-bs-toggle="modal" data-bs-target="#galleryArtworkModal" ${target} data-artwork-title="${esc(item.title)}" data-artwork-english-title="${esc(item.englishTitle)}" data-artwork-medium="${esc(item.medium)}" data-artwork-description="${esc(item.description)}" aria-label="${isVideo ? '播放影片：' : '查看作品：'}${esc(item.title)}"><img src="${esc(asset(first))}" alt="${esc(item.title)}" loading="lazy"><span class="gallery-caption">${esc(item.title)}</span></a>`;
    }).join('');
    const selected = pickThree([...grid.querySelectorAll('.gallery-photo')]);
    grid.querySelectorAll('.gallery-photo').forEach((item) => { item.hidden = !selected.has(item); });
    document.querySelectorAll('[data-gallery-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const category = button.dataset.galleryFilter;
        grid.querySelectorAll('.gallery-photo').forEach((item) => { item.hidden = item.dataset.category !== category; });
        document.querySelectorAll('[data-gallery-filter]').forEach((filter) => { const active = filter === button; filter.classList.toggle('active', active); filter.setAttribute('aria-pressed', String(active)); });
      });
    });
  }
  function renderProjects(items) {
    const grid = document.querySelector('.project-grid');
    if (!grid || !Array.isArray(items)) return;
    grid.innerHTML = items.filter((item) => item.visible !== false).map((item) => `<article class="col-lg-4 col-md-6 project-card"><a class="project-image" href="projects/view.html?id=${encodeURIComponent(item.id)}"><img src="${esc(asset(item.images?.[0]))}" alt="${esc(item.title)}" loading="lazy"></a><div class="project-tags">${(item.tags || []).map((tag) => `<span>${esc(tag)}</span>`).join('')}</div><h3>${esc(item.title)}</h3><p class="project-en">${esc(item.englishTitle)}</p><a class="project-link" href="projects/view.html?id=${encodeURIComponent(item.id)}">了解更多 <span aria-hidden="true">→</span></a></article>`).join('');
  }
  function renderArticles(items) {
    const list = document.querySelector('.journal-list');
    if (!list || !Array.isArray(items)) return;
    const articlePages = { bamboo: 'article-bamboo.html', museum: 'article-museum.html', pomelo: 'article-pomelo.html' };
    list.innerHTML = items.map((item) => `<a class="journal-item" href="${articlePages[item.id] || 'article.html'}"><time>${esc(item.date)}</time><span class="journal-copy"><strong>${esc(item.title)}</strong><small>${esc(item.summary || item.subtitle)}</small></span><span class="journal-category">${esc(item.category)}</span><span class="journal-arrow" aria-hidden="true">→</span></a>`).join('');
    const feature = document.querySelector('.journal-feature');
    if (feature && items[0]) {
      feature.href = articlePages[items[0].id] || 'article.html';
      const image = feature.querySelector('img'); if (image) { image.src = asset(items[0].images?.[0] || items[0].image); image.alt = `${items[0].title}封面`; }
      const strong = feature.querySelector('strong'); if (strong) strong.textContent = items[0].title;
    }
  }
  function renderProjectPage(content) {
    if (document.body.dataset.contentPage !== 'project') return;
    const projectId = new URLSearchParams(location.search).get('id') || document.body.dataset.projectId;
    const item = content.projects.find((project) => project.id === projectId);
    const main = document.querySelector('#managedProject');
    if (!main) return;
    if (!item) { main.innerHTML = '<article class="container"><h1>找不到這個專案</h1><a href="../index.html#projects">返回專案作品</a></article>'; return; }
    document.title = `${item.title}｜王鈺晴 Sunny`;
    const images = item.images || [];
    const carouselId = 'managedProjectCarousel';
    main.innerHTML = `<article class="container"><a class="project-back" href="../index.html#projects">← 專案作品</a>${images.length ? `<div id="${carouselId}" class="carousel slide project-carousel" aria-label="${esc(item.title)}作品照片"><div class="carousel-inner">${images.map((image, index) => `<div class="carousel-item ${index === 0 ? 'active' : ''}"><img src="${esc(asset(image))}" alt="${esc(item.title)}作品照片 ${index + 1}"></div>`).join('')}</div>${images.length > 1 ? `<button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev" aria-label="上一張作品"><span class="carousel-control-prev-icon" aria-hidden="true"></span></button><button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next" aria-label="下一張作品"><span class="carousel-control-next-icon" aria-hidden="true"></span></button>` : ''}</div>` : ''}<div class="project-detail-information"><aside class="project-detail-meta"><span class="section-tag">Selected Project</span><h1>${esc(item.title)}</h1><p class="project-en">${esc(item.englishTitle)}</p><div class="project-detail-tags">${(item.tags || []).map((tag) => `<span>${esc(tag)}</span>`).join('')}</div><p class="project-detail-year"><strong>年份</strong><span>${esc(item.year || '未標註')}</span></p></aside><section class="project-detail-copy"><h2>作品介紹</h2><p>${esc(item.description)}</p></section></div><a class="project-link" href="../index.html#projects">返回專案作品 <span aria-hidden="true">→</span></a></article>`;
  }
  function renderArticlePage(content) {
    if (document.body.dataset.contentPage !== 'article') return;
    const articleId = document.body.dataset.articleId || new URLSearchParams(location.search).get('id');
    const item = content.articles.find((article) => article.id === articleId) || content.articles[0];
    const article = document.querySelector('#managedArticle');
    if (!article || !item) return;
    article.querySelector('.section-tag').textContent = `Journal · ${item.category}`;
    article.querySelector('.article-date').textContent = item.date;
    article.querySelector('h1').textContent = item.title;
    article.querySelector('h1').id = 'article-start';
    const subtitle = article.querySelector('.article-subtitle');
    subtitle.textContent = item.subtitle || '';
    subtitle.hidden = !item.subtitle;
    const body = article.querySelector('.article-body');
    body.replaceChildren();
    const sections = item.sections || (item.content ? [{ heading: '', body: item.content }] : []);
    sections.filter((section) => section.heading || section.body).forEach((section, index) => {
      const sectionElement = document.createElement('section');
      sectionElement.className = 'article-content-section';
      if (section.heading) { const heading = document.createElement('h2'); heading.id = `article-section-${index + 1}`; heading.textContent = section.heading; sectionElement.append(heading); }
      String(section.body || '').split('\n').filter(Boolean).forEach((paragraph) => { const p = document.createElement('p'); p.textContent = paragraph; sectionElement.append(p); });
      body.append(sectionElement);
    });
    const outline = article.querySelector('.article-outline-list');
    if (outline) {
      const entries = [{ id: 'article-start', title: item.title, subtitle: item.subtitle || '' }];
      body.querySelectorAll('.article-content-section').forEach((section) => {
        const heading = section.querySelector('h2');
        if (!heading) return;
        entries.push({ id: heading.id, title: heading.textContent, subtitle: section.querySelector('p')?.textContent || '' });
      });
      outline.replaceChildren(...entries.map((entry) => {
        const link = document.createElement('a');
        link.className = 'article-outline-item';
        link.href = `#${entry.id}`;
        const title = document.createElement('strong'); title.textContent = entry.title;
        const subtitleText = document.createElement('small'); subtitleText.textContent = entry.subtitle;
        link.append(title, subtitleText);
        return link;
      }));
    }
    const imageList = item.images || (item.image ? [item.image] : []);
    const imageGrid = article.querySelector('.article-images');
    imageGrid.replaceChildren();
    imageList.forEach((src, index) => { const image = document.createElement('img'); image.className = 'article-cover'; image.src = asset(src); image.alt = `${item.title}文章圖片 ${index + 1}`; image.loading = 'lazy'; imageGrid.append(image); });
    imageGrid.hidden = imageList.length === 0;
    imageGrid.classList.toggle('single-image', imageList.length === 1);
    document.title = `${item.title}｜王鈺晴 Sunny`;
  }
  loadContent().then((content) => {
    if (!content) return;
    renderAbout(content.about || {});
    renderGallery(content.gallery || []);
    renderProjects(content.projects || []);
    renderArticles(content.articles || []);
    renderProjectPage(content);
    renderArticlePage(content);
  });
})();
