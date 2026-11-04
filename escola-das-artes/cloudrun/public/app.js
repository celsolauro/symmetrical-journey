let teachers = [];

const statusMeta = {
  normal: {label:'NORMAL', fill:'fill-normal', badge:'status-normal', color:'#0057B8'},
  alerta: {label:'ALERTA 60%', fill:'fill-alerta', badge:'status-alerta', color:'#F4B740'},
  critico: {label:'CRÍTICO', fill:'fill-critico', badge:'status-critico', color:'#E34A4A'},
  excedido: {label:'EXCEDIDO', fill:'fill-excedido', badge:'status-excedido', color:'#B32635'}
};

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('pt-BR');
let sortByConsumption = true;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));
const safeColor = (value) => /^#(?:[0-9a-f]{3}){1,2}$/i.test(String(value ?? '').trim())
  ? String(value).trim()
  : '#0057B8';
function setAxisOptions() {
  const selected = $('axisFilter').value;
  const axes = [...new Set(teachers.map(teacher => teacher.axis).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  $('axisFilter').replaceChildren(new Option('Todos os eixos', 'todos'));
  axes.forEach(axis => $('axisFilter').add(new Option(axis, axis)));
  $('axisFilter').value = axes.includes(selected) ? selected : 'todos';
}

// Os dados vêm do próprio servidor (Cloud Run atrás do IAP), que lê a planilha
// privada com uma identidade de serviço. Nenhum ID de planilha ou credencial
// chega ao navegador.
const MAX_ROWS = 500;
const cleanText = (value, max = 200) => String(value ?? '').slice(0, max);
const finiteNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

async function loadFromSheets(refresh = false) {
  $('sourceStatus').textContent = 'Fonte: Google Sheets · atualizando…';
  let response;
  try {
    response = await fetch(refresh ? '/api/professores?refresh=1' : '/api/professores', {
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      headers: {Accept: 'application/json'}
    });
  } catch (error) {
    throw new Error('Não foi possível consultar o servidor');
  }
  // O IAP responde com redirecionamento quando a sessão Google expira.
  if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
    $('sourceStatus').textContent = 'Sessão expirada · recarregue a página para entrar novamente';
    throw new Error('Sessão expirada');
  }
  if (!response.ok) throw new Error(`Servidor respondeu ${response.status}`);
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.teachers)) throw new Error('Resposta inválida do servidor');
  const loaded = payload.teachers.slice(0, MAX_ROWS).filter(t => t && t.code).map(t => ({
    name: cleanText(t.name),
    axis: cleanText(t.axis, 80),
    code: cleanText(t.code, 40),
    contract: cleanText(t.contract, 80),
    contracted: finiteNumber(t.contracted),
    executed: finiteNumber(t.executed),
    color: safeColor(t.color),
    monthly: Array.from({length: 6}, (_, i) => finiteNumber(Array.isArray(t.monthly) ? t.monthly[i] : 0)),
    action: cleanText(t.action, 500) || 'Conferir a medição do mês e manter o contrato em acompanhamento.'
  }));
  if (!loaded.length) throw new Error('Nenhum professor foi encontrado');
  teachers.splice(0, teachers.length, ...loaded);
  setAxisOptions();
  updateKpis();
  renderRows();
  $('sourceStatus').textContent = `Fonte: Google Sheets · atualizado às ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
}

function statusFor(percent) {
  if (percent >= 100) return 'excedido';
  if (percent >= 80) return 'critico';
  if (percent >= 60) return 'alerta';
  return 'normal';
}
function initials(name) { return name.split(' ').slice(0,2).map(part => part[0]).join('').toUpperCase(); }
function pct(value) { return `${value.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`; }
function teacherWithMetrics(teacher) {
  const percent = teacher.executed / teacher.contracted * 100;
  return {...teacher, percent, balance: teacher.contracted - teacher.executed, status: statusFor(percent)};
}

function renderRows() {
  const search = $('search').value.trim().toLowerCase();
  const statusFilter = $('statusFilter').value;
  const axisFilter = $('axisFilter').value;
  let data = teachers.map(teacherWithMetrics).filter(t => {
    const matchesSearch = !search || `${t.name} ${t.axis} ${t.code}`.toLowerCase().includes(search);
    const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
    const matchesAxis = axisFilter === 'todos' || t.axis === axisFilter;
    return matchesSearch && matchesStatus && matchesAxis;
  });
  data.sort((a,b) => sortByConsumption ? b.percent - a.percent : a.name.localeCompare(b.name));
  $('teacherRows').innerHTML = data.map(t => {
    const meta = statusMeta[t.status];
    const barWidth = Math.min(t.percent, 100);
    const name = escapeHtml(t.name);
    const axis = escapeHtml(t.axis);
    const code = escapeHtml(t.code);
    const color = safeColor(t.color);
    return `<article class="teacher-row" data-code="${code}" tabindex="0" role="button" aria-label="Abrir detalhes de ${name}">
      <div class="person"><div class="avatar" style="background:${color}">${escapeHtml(initials(t.name))}</div><div><strong>${name}</strong><span>${axis} · ${code}</span></div></div>
      <div class="progress-wrap"><div class="progress-meta"><span>${fmt.format(t.executed)} de ${fmt.format(t.contracted)} h</span><strong>${pct(t.percent)}</strong></div><div class="progress-track"><div class="progress-fill ${meta.fill}" style="width:${barWidth}%;background:${meta.color}"></div></div><div class="bar-key"><span>0</span><span>60</span><span>80</span><span>100%</span></div></div>
      <div class="right-num">${Math.round(t.percent)}%</div>
      <div class="row-hours"><div class="right-num">${fmt.format(Math.max(0,t.balance))} h</div><div class="hours-label">saldo</div></div>
      <div class="row-status"><span class="status ${meta.badge}">${meta.label}</span></div>
      <div class="row-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="m9 18 6-6-6-6"></path></svg></div>
    </article>`;
  }).join('');
  $('emptyState').hidden = data.length > 0;
  $('listSubtitle').textContent = `${data.length} registro${data.length === 1 ? '' : 's'} exibido${data.length === 1 ? '' : 's'} · dados carregados do Google Sheets`;
  document.querySelectorAll('.teacher-row').forEach(row => {
    row.addEventListener('click', () => openModal(row.dataset.code));
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(row.dataset.code); } });
  });
}

function openModal(code) {
  const t = teacherWithMetrics(teachers.find(item => item.code === code));
  const meta = statusMeta[t.status];
  $('modalAvatar').textContent = initials(t.name);
  $('modalAvatar').style.background = t.color;
  $('modalTitle').textContent = t.name;
  $('modalSubtitle').textContent = `${t.axis} · ${t.code} · contrato ${t.contract}`;
  $('detailContracted').textContent = `${fmt.format(t.contracted)} h`;
  $('detailExecuted').textContent = `${fmt.format(t.executed)} h`;
  $('detailBalance').textContent = `${fmt.format(Math.max(0,t.balance))} h`;
  $('detailPercent').textContent = pct(t.percent);
  const detailFill = $('detailFill');
  detailFill.style.width = `${Math.min(t.percent,100)}%`;
  detailFill.style.background = meta.color;
  detailFill.className = `progress-fill ${meta.fill}`;
  $('monthList').innerHTML = ['Jan','Fev','Mar','Abr','Mai','Jun'].map((month, i) => `<div class="month-row"><span>${month}/2027</span><div class="month-track"><div class="month-fill" style="width:${Math.min(t.monthly[i],100)}%;background:${t.monthly[i] >= 80 ? 'var(--red)' : t.monthly[i] >= 60 ? 'var(--yellow)' : 'var(--blue)'}"></div></div><strong>${t.monthly[i]}%</strong></div>`).join('');
  $('detailAction').textContent = t.action;
  $('modalBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  $('closeModal').focus();
}
function closeModal() { $('modalBackdrop').classList.remove('open'); document.body.style.overflow = ''; }

function updateKpis() {
  const metrics = teachers.map(teacherWithMetrics);
  const contracted = metrics.reduce((sum, teacher) => sum + teacher.contracted, 0);
  const executed = metrics.reduce((sum, teacher) => sum + teacher.executed, 0);
  const overall = contracted ? executed / contracted * 100 : 0;
  $('kpiTeachers').textContent = fmt.format(metrics.length);
  $('kpiContracted').textContent = fmt.format(contracted);
  $('kpiExecuted').textContent = fmt.format(executed);
  $('kpiOverall').textContent = `${pct(overall)} do contratado`;
  $('kpiAlert').textContent = metrics.filter(t => t.percent >= 60 && t.percent < 80).length;
  $('kpiCritical').textContent = metrics.filter(t => t.percent >= 80 && t.percent < 100).length;
  $('kpiExceeded').textContent = metrics.filter(t => t.percent >= 100).length;
}

$('search').addEventListener('input', renderRows);
$('statusFilter').addEventListener('change', renderRows);
$('axisFilter').addEventListener('change', renderRows);
$('sortBtn').addEventListener('click', () => { sortByConsumption = !sortByConsumption; $('sortBtn').classList.toggle('active', sortByConsumption); $('sortBtn').textContent = sortByConsumption ? 'Ordenar por consumo' : 'Ordenar por nome'; renderRows(); });
$('closeModal').addEventListener('click', closeModal);
$('modalBackdrop').addEventListener('click', e => { if (e.target === $('modalBackdrop')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('themeBtn').addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('eda-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); });
$('refreshBtn').addEventListener('click', async () => {
  try {
    await loadFromSheets(true);
    const toast = $('toast');
    toast.textContent = 'Dados atualizados do Google Sheets';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1900);
  } catch (error) {
    console.error(error);
    if (error.message !== 'Sessão expirada') $('sourceStatus').textContent = 'Fonte: Google Sheets · não foi possível atualizar';
  }
});
if (localStorage.getItem('eda-theme') === 'dark') document.body.classList.add('dark');
$('sortBtn').classList.add('active');
loadFromSheets().catch(error => {
  console.error(error);
  if (error.message !== 'Sessão expirada') $('sourceStatus').textContent = 'Fonte: Google Sheets · falha de leitura';
});
