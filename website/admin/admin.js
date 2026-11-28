const statusLabels = {
  active: 'Актуально',
  ending: 'Скоро закончится',
  permanent: 'Бесплатно постоянно',
  ended: 'Завершено',
  unknown: 'Не подтверждено',
  queued: 'Ожидает',
  sending: 'Отправляется',
  uncertain: 'Нужна проверка',
  blocked: 'Заблокировано',
};
const state = { data: null, tab: 'published', selected: null };
const $ = (selector) => document.querySelector(selector);

function date(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Не указано';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function status(item) {
  if (item.messageId === undefined) return item.status;
  if (item.endsAt && Date.parse(item.endsAt) <= Date.now()) return 'ended';
  if (item.endsAt && Date.parse(item.endsAt) - Date.now() < 48 * 60 * 60_000)
    return 'ending';
  return item.status;
}

function renderStats() {
  const published = state.data.published;
  const queue = state.data.queue;
  $('#stat-published').textContent = String(published.length);
  $('#stat-active').textContent = String(
    published.filter((item) =>
      ['active', 'ending', 'permanent'].includes(status(item)),
    ).length,
  );
  $('#stat-ended').textContent = String(
    published.filter(
      (item) => item.endsAt && Date.parse(item.endsAt) <= Date.now(),
    ).length,
  );
  $('#stat-queued').textContent = String(
    queue.filter((item) => item.status === 'queued').length,
  );
  $('#stat-attention').textContent = String(
    queue.filter((item) =>
      ['sending', 'uncertain', 'blocked'].includes(item.status),
    ).length,
  );
  $('#updated').textContent =
    `Данные обновлены: ${date(state.data.generatedAt)} · Файл публикаций: ${date(state.data.filesUpdatedAt.published)}`;
}

function renderFilters() {
  const select = $('#status-filter');
  const current = select.value;
  select.replaceChildren(element('option', '', 'Все статусы'));
  select.firstChild.value = '';
  const values = [...new Set(state.data[state.tab].map(status))];
  for (const value of values) {
    const option = element('option', '', statusLabels[value] || value);
    option.value = value;
    select.append(option);
  }
  select.value = values.includes(current) ? current : '';
}

function renderList() {
  const search = $('#search').value.trim().toLocaleLowerCase('ru');
  const wantedStatus = $('#status-filter').value;
  const filtered = state.data[state.tab].filter((item) => {
    if (wantedStatus && status(item) !== wantedStatus) return false;
    return (
      !search ||
      [
        item.title,
        item.id,
        item.source,
        item.channelId,
        ...(item.platforms || []),
      ]
        .join(' ')
        .toLocaleLowerCase('ru')
        .includes(search)
    );
  });
  $('#count').textContent =
    `${filtered.length} / ${state.data[state.tab].length}`;
  const list = $('#items');
  list.replaceChildren();
  if (!filtered.length) {
    const empty = element('div', 'list-empty');
    empty.append(
      element('strong', '', 'Ничего не найдено'),
      element('p', '', 'Попробуйте изменить поиск или статус.'),
    );
    list.append(empty);
    return;
  }
  for (const item of filtered) {
    const row = element('button', 'item');
    row.type = 'button';
    row.classList.toggle(
      'selected',
      state.selected?.id === item.id &&
        state.selected?.messageId === item.messageId,
    );
    const upper = element('span', 'item-upper');
    upper.append(
      element('span', 'item-category', item.category || 'материал'),
      element(
        'span',
        `pill ${status(item)}`,
        statusLabels[status(item)] || status(item),
      ),
    );
    row.append(
      upper,
      element('strong', 'item-title', item.title || item.id),
      element(
        'span',
        'item-meta',
        `${item.source || 'Источник не указан'} · ${date(item.sentAt || item.queuedAt)}`,
      ),
    );
    row.addEventListener('click', () => {
      state.selected = item;
      renderList();
      renderDetails();
    });
    list.append(row);
  }
}

function detail(label, value) {
  const row = element('div', 'detail-row');
  row.append(
    element('dt', '', label),
    element('dd', '', value || 'Не указано'),
  );
  return row;
}

function link(label, href) {
  if (!href || !href.startsWith('https://')) return null;
  const anchor = element('a', 'detail-link', `${label} ↗`);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function renderDetails() {
  const panel = $('#details');
  panel.replaceChildren();
  const item = state.selected;
  if (!item) {
    const empty = element('div', 'detail-empty');
    empty.append(
      element('span', '', '⌕'),
      element('h2', '', 'Выберите материал'),
      element('p', '', 'Здесь появятся его статус, источник и даты.'),
    );
    panel.append(empty);
    return;
  }
  panel.append(
    element(
      'div',
      'eyebrow',
      state.tab === 'published' ? '// ОПУБЛИКОВАНО' : '// ОЧЕРЕДЬ',
    ),
  );
  panel.append(element('h2', 'detail-title', item.title || item.id));
  panel.append(
    element(
      'span',
      `pill ${status(item)}`,
      statusLabels[status(item)] || status(item),
    ),
  );
  const rows = element('dl', 'detail-grid');
  rows.append(
    detail('ID', item.id),
    detail('Канал', item.channelId),
    detail('Категория', item.category),
    detail('Платформы', item.platforms?.join(', ')),
    detail('Источник', item.source),
    detail(
      state.tab === 'published' ? 'Опубликовано' : 'Добавлено в очередь',
      date(item.sentAt || item.queuedAt),
    ),
    detail('Окончание', date(item.endsAt)),
  );
  if (state.tab === 'published')
    rows.append(
      detail('Telegram message ID', String(item.messageId)),
      detail(
        'Текущая цена',
        item.currentPrice === '0' ? 'Бесплатно' : item.currentPrice,
      ),
    );
  panel.append(rows);
  const links = element('div', 'detail-links');
  for (const anchor of [
    link('Источник', item.sourceUrl),
    link('Пост в Telegram', item.telegramUrl),
  ])
    if (anchor) links.append(anchor);
  panel.append(links);
  if (
    state.tab === 'queue' &&
    ['sending', 'uncertain', 'blocked'].includes(item.status)
  )
    panel.append(
      element(
        'p',
        'warning',
        'Проверьте состояние в Telegram вручную перед повторной отправкой.',
      ),
    );
}

function render() {
  renderStats();
  renderFilters();
  renderList();
  renderDetails();
}

async function load() {
  $('#notice').textContent = '';
  $('#refresh').disabled = true;
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error('Не удалось загрузить данные');
    state.data = await response.json();
    state.selected =
      state.data[state.tab].find((item) => item.id === state.selected?.id) ||
      null;
    render();
    $('#notice').textContent = 'Данные перечитаны из локальных файлов.';
  } catch (error) {
    $('#notice').textContent = error.message;
  } finally {
    $('#refresh').disabled = false;
  }
}

for (const tab of ['published', 'queue']) {
  $(`#tab-${tab}`).addEventListener('click', () => {
    state.tab = tab;
    state.selected = null;
    $('#tab-published').setAttribute(
      'aria-selected',
      String(tab === 'published'),
    );
    $('#tab-queue').setAttribute('aria-selected', String(tab === 'queue'));
    renderFilters();
    renderList();
    renderDetails();
  });
}
$('#search').addEventListener('input', renderList);
$('#status-filter').addEventListener('change', renderList);
$('#refresh').addEventListener('click', load);
void load();
