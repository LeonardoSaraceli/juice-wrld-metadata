const state = {
  tracks: [],
  selectedId: null,
  catalogPage: 1,
  catalogQuery: "",
  catalogData: null,
  catalogFiltersLoaded: false,
  catalogFiltersLoading: false,
  catalogSelected: new Map(),
  catalogQueueRunning: false,
  coversPath: "Cover Arts",
  coversQuery: "",
  coversPage: 1,
  coversData: null,
  coversLayout: localStorage.getItem("covers-layout") === "list" ? "list" : "grid",
  coversRequest: 0,
  processing: false,
  lyricsBulkRunning: false,
  qualityResults: [],
  qualityRunning: false,
  qualityRoot: "",
  qualityPage: 1,
  qualityPageSize: 36,
  editorCoverResults: [],
  editorOriginalResults: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let coverObserver = null;
let coverThumbnailGeneration = 0;
let coverThumbnailQueue = [];
let activeCoverThumbnailLoads = 0;
let qualityRenderTimer = null;
const lyricsMatches = new Map();
const lyricsRequests = new Map();
const coverView = {
  scale: 1
};

const elements = {
  nav: $$(".nav-item"),
  views: $$(".view"),
  addMusic: $("#add-music"),
  emptyAdd: $("#empty-add"),
  removeSelected: $("#remove-selected"),
  trackList: $("#track-list"),
  trackCount: $("#track-count"),
  editorEmpty: $("#editor-empty"),
  inspector: $("#inspector"),
  inspectorEmpty: $(".inspector-empty"),
  inspectorContent: $(".inspector-content"),
  coverControl: $("#cover-control"),
  coverPreview: $("#cover-preview"),
  editorCoverQuery: $("#editor-cover-query"),
  editorCoverSubmit: $("#editor-cover-submit"),
  editorCoverResults: $("#editor-cover-results"),
  editorOriginalQuery: $("#editor-original-query"),
  editorOriginalSubmit: $("#editor-original-submit"),
  editorOriginalResults: $("#editor-original-results"),
  editorOriginalComparison: $("#editor-original-comparison"),
  selectedType: $("#selected-type"),
  selectedTitle: $("#selected-title"),
  selectedFile: $("#selected-file"),
  form: $("#metadata-form"),
  lyricsSearchAll: $("#lyrics-search-all"),
  lyricsSearch: $("#lyrics-search"),
  lyricsMatch: $("#lyrics-match"),
  lyricsFormat: $("#lyrics-format"),
  formatButtons: $$(".segmented button"),
  formatHint: $("#format-hint"),
  readyCount: $("#ready-count"),
  saveAll: $("#save-all"),
  catalogSearch: $("#catalog-search"),
  catalogSubmit: $("#catalog-submit"),
  catalogEra: $("#catalog-era"),
  catalogFormat: $("#catalog-format"),
  catalogBatch: $("#catalog-batch"),
  catalogSelectPage: $("#catalog-select-page"),
  catalogSelectedCount: $("#catalog-selected-count"),
  catalogClearSelection: $("#catalog-clear-selection"),
  catalogDownloadSelected: $("#catalog-download-selected"),
  catalogQueueProgress: $("#catalog-queue-progress"),
  catalogQueueLabel: $("#catalog-queue-label"),
  catalogQueueBar: $("#catalog-queue-bar"),
  catalogGrid: $("#catalog-grid"),
  catalogEmpty: $("#catalog-empty"),
  catalogCount: $("#catalog-count"),
  pagination: $("#catalog-pagination"),
  catalogPrev: $("#catalog-prev"),
  catalogNext: $("#catalog-next"),
  catalogPage: $("#catalog-page"),
  coversSearch: $("#covers-search"),
  coversSubmit: $("#covers-submit"),
  coversCount: $("#covers-count"),
  coversBreadcrumbs: $("#covers-breadcrumbs"),
  coversGrid: $("#covers-grid"),
  coversGridView: $("#covers-grid-view"),
  coversListView: $("#covers-list-view"),
  coversEmpty: $("#covers-empty"),
  coversPagination: $("#covers-pagination"),
  coversPrev: $("#covers-prev"),
  coversNext: $("#covers-next"),
  coversPage: $("#covers-page"),
  coverViewerBackdrop: $("#cover-viewer-backdrop"),
  coverViewer: $("#cover-viewer"),
  coverViewerStage: $("#cover-viewer-stage"),
  coverViewerImage: $("#cover-viewer-image"),
  coverViewerTitle: $("#cover-viewer-title"),
  coverViewerCreator: $("#cover-viewer-creator"),
  coverInfoDimensions: $("#cover-info-dimensions"),
  coverInfoFormat: $("#cover-info-format"),
  coverInfoSize: $("#cover-info-size"),
  coverZoomOut: $("#cover-zoom-out"),
  coverZoomIn: $("#cover-zoom-in"),
  coverZoomReset: $("#cover-zoom-reset"),
  closeCoverViewer: $("#close-cover-viewer"),
  trackerSearch: $("#tracker-search"),
  trackerSubmit: $("#tracker-submit"),
  trackerList: $("#tracker-list"),
  trackerEmpty: $("#tracker-empty"),
  trackerCount: $("#tracker-count"),
  qualityScan: $("#quality-scan"),
  qualityCancel: $("#quality-cancel"),
  qualityProgress: $("#quality-progress"),
  qualityProgressTitle: $("#quality-progress-title"),
  qualityProgressCopy: $("#quality-progress-copy"),
  qualityProgressBar: $("#quality-progress-bar"),
  qualitySummary: $("#quality-summary"),
  qualityTotal: $("#quality-total"),
  qualityOk: $("#quality-ok"),
  qualityLossy: $("#quality-lossy"),
  qualitySuspect: $("#quality-suspect"),
  qualityReview: $("#quality-review"),
  qualityToolbar: $("#quality-toolbar"),
  qualitySearch: $("#quality-search"),
  qualityFilter: $("#quality-filter"),
  qualityCount: $("#quality-count"),
  qualityList: $("#quality-list"),
  qualityEmpty: $("#quality-empty"),
  qualityPagination: $("#quality-pagination"),
  qualityPrev: $("#quality-prev"),
  qualityNext: $("#quality-next"),
  qualityPage: $("#quality-page"),
  catalogTrackerBackdrop: $("#catalog-tracker-backdrop"),
  catalogTrackerDrawer: $("#catalog-tracker-drawer"),
  catalogTrackerQuery: $("#catalog-tracker-query"),
  catalogTrackerContent: $("#catalog-tracker-content"),
  closeCatalogTracker: $("#close-catalog-tracker"),
  miniPlayer: $("#mini-player"),
  playerCover: $("#player-cover"),
  playerTitle: $("#player-title"),
  playerArtist: $("#player-artist"),
  audioPlayer: $("#audio-player"),
  closePlayer: $("#close-player"),
  loading: $("#loading-overlay"),
  loadingTitle: $("#loading-title"),
  loadingCopy: $("#loading-copy"),
  progressBar: $("#progress-bar"),
  toastRegion: $("#toast-region")
};

function refreshIcons() {
  window.lucide?.createIcons({ attrs: { "stroke-width": 1.8, "aria-hidden": "true" } });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDuration(seconds) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (!value) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / (1024 ** unit);
  return `${amount.toLocaleString("pt-BR", { maximumFractionDigits: unit ? 1 : 0 })} ${units[unit]}`;
}

function debounce(callback, wait = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
}

function toast(title, message, type = "success") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.innerHTML = `
    <div class="toast-icon"><i data-lucide="${type === "error" ? "circle-alert" : "check"}"></i></div>
    <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></div>
  `;
  elements.toastRegion.append(item);
  refreshIcons();
  setTimeout(() => item.remove(), 5200);
}

function setLoading(visible, title = "Carregando", copy = "Só um momento...") {
  elements.loading.classList.toggle("hidden", !visible);
  elements.loadingTitle.textContent = title;
  elements.loadingCopy.textContent = copy;
  if (!visible) elements.progressBar.style.width = "0%";
}

function selectedTrack() {
  return state.tracks.find((track) => track.id === state.selectedId) || null;
}

function switchView(view) {
  elements.nav.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  elements.views.forEach((item) => item.classList.toggle("active", item.id === `view-${view}`));
  if (view === "catalog") loadCatalogFilterOptions();
}

function qualityStatusLabel(status) {
  return {
    ok: "Compatível",
    suspect: "Suspeito",
    review: "Revisar",
    lossy: "Com perdas",
    error: "Erro"
  }[status] || "Inconclusivo";
}

function qualityMetrics(item) {
  const values = [item.extension, String(item.codec || "").toUpperCase()];
  if (item.sampleRate) values.push(`${(item.sampleRate / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kHz`);
  if (item.bits) values.push(`${item.bits}-bit`);
  if (item.bitRate) values.push(`${Math.round(item.bitRate / 1000)} kbps`);
  if (item.duration) values.push(formatDuration(item.duration));
  return values.filter(Boolean).join(" · ");
}

function qualitySpectrumMetrics(spectrum) {
  const analyzed = Number(spectrum?.analyzedSegments || 0);
  const confirmations = Number(spectrum?.confirmations || 0);
  if (analyzed > 1) {
    return `${analyzed} trechos analisados · ${confirmations} ${confirmations === 1 ? "borda coincidente" : "bordas coincidentes"}`;
  }
  return "1 trecho de triagem analisado";
}

function lyricsFormattingReport(value) {
  const text = String(value || "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return { issues: [], fixable: false };
  const issues = [];
  const add = (code, message, fixable = false) => {
    if (!issues.some((issue) => issue.code === code)) issues.push({ code, message, fixable });
  };
  if (/\[(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.:]\d+)?\]/.test(text)) {
    add("timestamps", "Contém marcações de tempo; a letra estática deve ser texto simples.");
  }
  if (/<\/?[a-z][^>]*>/i.test(text)) add("html", "Contém HTML; o Apple Music usa texto simples.");
  if (/^\s*\[(?:intro|verse|chorus|hook|bridge|outro|refrain|pre-chorus|post-chorus)[^\]]*\]\s*$/im) {
    add("section-labels", "Contém rótulos como [Verse] ou [Chorus]; use apenas quebras entre estrofes.");
  }
  if (/\n[ \t]*\n[ \t]*\n/.test(text)) add("blank-lines", "Há mais de uma linha vazia entre estrofes.", true);
  if (text.split("\n").some((line) => /[ \t]+$/.test(line))) add("trailing-space", "Há espaços sobrando no fim de linhas.", true);
  if (/\((?:repeat|repete|x)\s*(?:x\s*)?\d+\)/i.test(text)) {
    add("repeat", "Repetições devem ser escritas por extenso, não indicadas como “repeat x3”.");
  }
  const lyricLines = text.split("\n").filter((line) => line.trim());
  if (lyricLines.some((line) => /[.,](?:["”’])?$/.test(line.trim()))) {
    add("ending-punctuation", "Linhas não devem terminar com ponto ou vírgula.", true);
  }
  if (lyricLines.some((line) => {
    const match = line.trim().match(/^[\s("“'’]*([A-Za-zÀ-ÖØ-öø-ÿ])/);
    return Boolean(match && match[1] === match[1].toLocaleLowerCase() && match[1] !== match[1].toLocaleUpperCase());
  })) {
    add("capitalization", "Toda linha deve começar com letra maiúscula, respeitando nomes e estilização.", true);
  }
  return { issues, fixable: issues.some((issue) => issue.fixable) };
}

function safelyFormatLyrics(value) {
  const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
  const formatted = [];
  let previousBlank = true;
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) {
      if (!previousBlank && formatted.length) formatted.push("");
      previousBlank = true;
      continue;
    }
    line = line.replace(/[.,](?=(["”’])?$)/, "");
    line = line.replace(/^([\s("“'’]*)([a-zà-öø-ÿ])/, (_match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase()}`);
    formatted.push(line);
    previousBlank = false;
  }
  while (formatted.at(-1) === "") formatted.pop();
  return formatted.join("\n");
}

function renderLyricsFormatting(track) {
  const text = String(track?.lyrics || "");
  if (!text.trim()) {
    elements.lyricsFormat.classList.add("hidden");
    elements.lyricsFormat.innerHTML = "";
    return;
  }
  const report = lyricsFormattingReport(text);
  elements.lyricsFormat.classList.remove("hidden");
  elements.lyricsFormat.classList.toggle("valid", !report.issues.length);
  elements.lyricsFormat.innerHTML = report.issues.length
    ? `
      <div class="lyrics-format-heading"><span class="badge badge-warning badge-sm">Revisar formato</span><strong>${report.issues.length} ${report.issues.length === 1 ? "ajuste encontrado" : "ajustes encontrados"}</strong></div>
      <ul>${report.issues.slice(0, 6).map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")}</ul>
      ${report.fixable ? '<button class="btn btn-ghost btn-xs" type="button" data-format-lyrics>Aplicar correções seguras</button>' : ""}
    `
    : '<div class="lyrics-format-heading"><span class="badge badge-success badge-sm">Formato compatível</span><strong>Estrutura pronta para letra estática</strong></div><p>Quebras de linha, estrofes e pontuação seguem as regras editoriais verificáveis do Apple Music.</p>';
}

function filteredQualityResults() {
  const query = elements.qualitySearch.value.trim().toLocaleLowerCase("pt-BR");
  const filter = elements.qualityFilter.value;
  return state.qualityResults
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (filter === "attention" && !["suspect", "review", "error"].includes(item.status)) return false;
      if (!['all', 'attention'].includes(filter) && item.status !== filter) return false;
      return !query || `${item.name} ${item.relativePath}`.toLocaleLowerCase("pt-BR").includes(query);
    })
    .sort((left, right) => {
      const priority = { suspect: 0, error: 1, review: 2, lossy: 3, ok: 4 };
      return (priority[left.item.status] ?? 5) - (priority[right.item.status] ?? 5) ||
        left.item.relativePath.localeCompare(right.item.relativePath, "pt-BR", { sensitivity: "base" });
    });
}

function renderQualityResults() {
  clearTimeout(qualityRenderTimer);
  qualityRenderTimer = null;
  const counts = state.qualityResults.reduce((summary, item) => {
    summary[item.status] = (summary[item.status] || 0) + 1;
    return summary;
  }, {});
  elements.qualityTotal.textContent = state.qualityResults.length;
  elements.qualityOk.textContent = counts.ok || 0;
  elements.qualityLossy.textContent = counts.lossy || 0;
  elements.qualitySuspect.textContent = counts.suspect || 0;
  elements.qualityReview.textContent = (counts.review || 0) + (counts.error || 0);

  const rows = filteredQualityResults();
  const pageCount = Math.max(1, Math.ceil(rows.length / state.qualityPageSize));
  state.qualityPage = Math.min(Math.max(1, state.qualityPage), pageCount);
  const pageStart = (state.qualityPage - 1) * state.qualityPageSize;
  const visibleRows = rows.slice(pageStart, pageStart + state.qualityPageSize);
  elements.qualityCount.textContent = `${rows.length} ${rows.length === 1 ? "arquivo" : "arquivos"}`;
  elements.qualityList.innerHTML = visibleRows.map(({ item, index }) => `
    <article class="quality-row card ${item.status}" data-quality-index="${index}">
      <div class="quality-row-main">
        <div class="quality-file-icon">${escapeHtml(item.extension || "?")}</div>
        <div class="quality-file-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <span title="${escapeHtml(item.relativePath)}">${escapeHtml(item.relativePath)}</span>
        </div>
        <span class="quality-status badge ${item.status}">${qualityStatusLabel(item.status)}</span>
      </div>
      <div class="quality-technical">
        <div class="quality-metric-line">${qualityMetrics(item).split(" · ").filter(Boolean).map((metric) => `<span class="badge badge-ghost badge-sm">${escapeHtml(metric)}</span>`).join("")}</div>
        <p>${escapeHtml(item.reason)}</p>
        ${item.spectrum ? `<small><i data-lucide="activity"></i>${escapeHtml(qualitySpectrumMetrics(item.spectrum))}</small>` : ""}
      </div>
      <div class="quality-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-quality-action="spek"><i data-lucide="audio-lines"></i>Spek</button>
        <button class="btn btn-ghost btn-sm" type="button" data-quality-action="folder"><i data-lucide="folder-open"></i>Pasta</button>
      </div>
    </article>
  `).join("");
  elements.qualityPagination.classList.toggle("hidden", rows.length <= state.qualityPageSize);
  elements.qualityPage.textContent = `Página ${state.qualityPage} de ${pageCount}`;
  elements.qualityPrev.disabled = state.qualityPage <= 1;
  elements.qualityNext.disabled = state.qualityPage >= pageCount;
  const hasScan = state.qualityResults.length > 0 || state.qualityRunning;
  elements.qualitySummary.classList.toggle("hidden", !hasScan);
  elements.qualityToolbar.classList.toggle("hidden", !hasScan);
  elements.qualityEmpty.classList.toggle("hidden", hasScan && (rows.length > 0 || state.qualityResults.length > 0));
  if (!rows.length && state.qualityResults.length) {
    elements.qualityEmpty.classList.remove("hidden");
    elements.qualityEmpty.querySelector("h3").textContent = "Nenhum arquivo neste filtro";
    elements.qualityEmpty.querySelector("p").textContent = "Altere o resultado selecionado ou o termo de busca.";
  }
  refreshIcons();
}

function scheduleQualityRender() {
  if (qualityRenderTimer) return;
  qualityRenderTimer = setTimeout(renderQualityResults, 500);
}

async function startQualityScan() {
  if (state.qualityRunning) return;
  state.qualityRunning = true;
  state.qualityResults = [];
  state.qualityPage = 1;
  elements.qualityEmpty.querySelector("h3").textContent = "Verifique sua biblioteca";
  elements.qualityEmpty.querySelector("p").textContent = "Nenhum arquivo é alterado. A análise começa somente quando você solicitar.";
  elements.qualitySearch.value = "";
  elements.qualityFilter.value = "all";
  elements.qualityScan.disabled = true;
  elements.qualityScan.textContent = "Analisando...";
  elements.qualityCancel.classList.remove("hidden");
  elements.qualityProgress.classList.remove("hidden");
  elements.qualityProgressTitle.textContent = "Localizando músicas...";
  elements.qualityProgressCopy.textContent = "Pasta Music e subpastas";
  elements.qualityProgressBar.style.width = "0%";
  renderQualityResults();
  let cancelled = false;
  try {
    const result = await window.juice.scanQuality();
    cancelled = Boolean(result.cancelled);
    state.qualityRoot = result.rootPath || state.qualityRoot;
    if (result.cancelled) toast("Análise cancelada", `${state.qualityResults.length} arquivos foram verificados até o cancelamento.`);
    else {
      const suspects = state.qualityResults.filter((item) => item.status === "suspect").length;
      toast("Análise concluída", suspects ? `${suspects} arquivo(s) suspeito(s) pedem confirmação no Spek.` : "Nenhum indício forte de arquivo suspeito foi encontrado.");
    }
  } catch (error) {
    toast("Não foi possível analisar", error.message, "error");
  } finally {
    state.qualityRunning = false;
    elements.qualityScan.disabled = false;
    elements.qualityScan.textContent = "Analisar novamente";
    elements.qualityCancel.classList.add("hidden");
    elements.qualityProgressTitle.textContent = cancelled ? "Análise interrompida" : "Análise concluída";
    renderQualityResults();
  }
}

async function cancelQualityScan() {
  if (!state.qualityRunning) return;
  elements.qualityCancel.disabled = true;
  elements.qualityCancel.textContent = "Cancelando...";
  await window.juice.cancelQualityScan();
  elements.qualityCancel.disabled = false;
  elements.qualityCancel.textContent = "Cancelar";
}

function coverMarkup(track, className = "row-cover") {
  if (track.coverDataUrl) return `<img class="${className}" src="${track.coverDataUrl}" alt="" />`;
  return `<div class="${className} placeholder">999</div>`;
}

function lyricsStatusMarkup(track) {
  const labels = {
    ready: "Letra",
    review: "Revisar",
    missing: "Sem letra",
    searching: "Buscando",
    error: "Erro"
  };
  const status = track.lyricsStatus || (track.lyrics ? "ready" : "idle");
  if (!labels[status]) return "";
  return `<em class="lyrics-status ${status}">${labels[status]}</em>`;
}

function renderTracks() {
  elements.trackList.innerHTML = state.tracks
    .map(
      (track) => `
        <button class="track-row ${track.id === state.selectedId ? "selected" : ""}" data-id="${track.id}">
          ${coverMarkup(track)}
          <span class="row-copy">
            <strong>${escapeHtml(track.title || track.fileName)}</strong>
            <span class="row-subline"><span class="row-filename">${escapeHtml(track.fileName)}</span>${lyricsStatusMarkup(track)}</span>
          </span>
          <span class="type-badge">${escapeHtml(track.type)}</span>
          <span class="row-remove" data-remove="${track.id}" title="Remover"><i data-lucide="x"></i></span>
        </button>
      `
    )
    .join("");

  const count = state.tracks.length;
  elements.trackCount.textContent = `${count} ${count === 1 ? "arquivo" : "arquivos"}`;
  elements.editorEmpty.classList.toggle("hidden", count > 0);
  elements.saveAll.disabled = count === 0 || state.processing;
  elements.lyricsSearchAll.disabled = count === 0 || state.lyricsBulkRunning;
  elements.removeSelected.disabled = !state.selectedId;
  elements.readyCount.textContent = count ? `${count} ${count === 1 ? "música pronta" : "músicas prontas"}` : "Nenhuma música pronta";
  refreshIcons();
  renderInspector();
}

function renderInspector() {
  const track = selectedTrack();
  elements.inspectorEmpty.classList.toggle("hidden", Boolean(track));
  elements.inspectorContent.classList.toggle("hidden", !track);
  if (!track) return;

  if (elements.inspector.dataset.trackId !== track.id) {
    elements.inspector.dataset.trackId = track.id;
    state.editorCoverResults = [];
    state.editorOriginalResults = [];
    elements.editorCoverQuery.value = "";
    elements.editorOriginalQuery.value = "";
    elements.editorCoverResults.innerHTML = "";
    elements.editorOriginalResults.innerHTML = "";
    elements.editorOriginalComparison.classList.add("hidden");
    elements.editorOriginalComparison.innerHTML = "";
  }

  elements.selectedType.textContent = track.type;
  elements.selectedTitle.textContent = track.title || "Sem título";
  elements.selectedFile.textContent = track.fileName;
  elements.coverControl.classList.toggle("has-cover", Boolean(track.coverDataUrl));
  elements.coverPreview.src = track.coverDataUrl || "";
  for (const input of elements.form.elements) {
    if (input.name) input.value = track[input.name] || "";
  }
  elements.formatButtons.forEach((button) => {
    const active = button.dataset.format === track.outputMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
  elements.formatHint.textContent =
    track.outputMode === "alac"
      ? "ALAC mantém a qualidade lossless e é compatível com Apple Music."
      : "O codec original será preservado sem recodificação.";
  elements.lyricsSearch.disabled = state.lyricsBulkRunning;
  renderLyricsMatch(track);
  renderLyricsFormatting(track);
  if (track.originalComparison) renderOriginalComparison(track.originalComparison.original, track.originalComparison.result);
}

async function addMusic() {
  try {
    setLoading(true, "Lendo arquivos", "Identificando metadados e capas...");
    const result = await window.juice.addMusic();
    const tracks = Array.isArray(result) ? result : (result.tracks || []);
    const errors = Array.isArray(result) ? [] : (result.errors || []);
    const existing = new Set(state.tracks.map((track) => track.path.toLowerCase()));
    const fresh = tracks.filter((track) => !existing.has(track.path.toLowerCase()));
    state.tracks.push(...fresh);
    if (!state.selectedId && fresh[0]) state.selectedId = fresh[0].id;
    renderTracks();
    if (fresh.length) toast("Músicas adicionadas", `${fresh.length} ${fresh.length === 1 ? "arquivo foi preparado" : "arquivos foram preparados"}.`);
    if (errors.length) {
      toast(
        "Alguns arquivos não foram adicionados",
        `${errors.length} ${errors.length === 1 ? "arquivo apresentou erro" : "arquivos apresentaram erro"}. Os demais foram mantidos no editor.`,
        "error"
      );
    }
  } catch (error) {
    toast("Não foi possível adicionar", error.message, "error");
  } finally {
    setLoading(false);
  }
}

function removeTrack(id) {
  lyricsMatches.delete(id);
  lyricsRequests.delete(id);
  state.tracks = state.tracks.filter((track) => track.id !== id);
  if (state.selectedId === id) state.selectedId = state.tracks[0]?.id || null;
  renderTracks();
}

function renderLyricsMatch(track) {
  const result = track ? lyricsMatches.get(track.id) : null;
  elements.lyricsMatch.className = "lyrics-match";
  if (!result) {
    elements.lyricsMatch.classList.add("hidden");
    elements.lyricsMatch.innerHTML = "";
    return;
  }
  elements.lyricsMatch.classList.toggle("warning", !["matched", "manual"].includes(result.status));
  if (result.status === "matched" || result.status === "manual") {
    const match = result.match;
    elements.lyricsMatch.innerHTML = `
      <strong>${result.status === "manual" ? "Opção selecionada" : "Letra adicionada para revisão"}: ${escapeHtml(match.title)}</strong>
      <span>${escapeHtml([match.artists, match.era, match.length].filter(Boolean).join(" · "))}</span>
      <span>${escapeHtml(match.reason)}</span>
    `;
    return;
  }
  if (result.status === "searching") {
    elements.lyricsMatch.innerHTML = `
      <strong>Pesquisando letra...</strong>
      <span>${escapeHtml(result.message)}</span>
    `;
    return;
  }
  const candidates = (result.candidates || []).slice(0, 5);
  elements.lyricsMatch.innerHTML = `
    <strong>${result.status === "ambiguous" ? "Escolha a correspondência correta" : "A letra não foi adicionada"}</strong>
    <span>${escapeHtml(result.message)}</span>
    ${candidates.length ? `<div class="lyrics-candidates">${candidates.map((candidate) => `
      <button type="button" class="lyrics-candidate" data-lyrics-candidate="${candidate.id}">
        <strong>${escapeHtml(candidate.title)}</strong>
        <span>${escapeHtml([candidate.artists, candidate.era, candidate.length].filter(Boolean).join(" · "))}</span>
      </button>`).join("")}</div>` : ""}
    <div class="lyrics-alternative">
      <label for="lyrics-alternative-title">Pesquisar por outro título</label>
      <div>
        <input id="lyrics-alternative-title" type="text" value="${escapeHtml(result.searchTitle || "")}" placeholder="Outro título ou alias" autocomplete="off" />
        <button type="button" class="button secondary" data-lyrics-alternative>Pesquisar</button>
      </div>
    </div>
  `;
}

function lyricsLookupPayload(track, searchTitle = "") {
  const alternativeTitle = String(searchTitle || "").trim();
  return {
    title: alternativeTitle || track.title,
    fileName: alternativeTitle ? `${alternativeTitle}.mp3` : track.fileName,
    path: alternativeTitle ? "" : track.path,
    duration: track.duration,
    artist: track.artist,
    album: track.album
  };
}

function updateLyricsStatusUI(track) {
  const row = [...elements.trackList.querySelectorAll("[data-id]")].find((item) => item.dataset.id === track.id);
  const subline = row?.querySelector(".row-subline");
  if (subline) {
    subline.querySelector(".lyrics-status")?.remove();
    subline.insertAdjacentHTML("beforeend", lyricsStatusMarkup(track));
  }
  if (selectedTrack()?.id === track.id) {
    const input = elements.form.elements.lyrics;
    if (input.value !== (track.lyrics || "")) input.value = track.lyrics || "";
    renderLyricsMatch(track);
    renderLyricsFormatting(track);
  }
}

async function lookupLyrics(track, searchTitle = "") {
  const alternativeTitle = String(searchTitle || "").trim();
  const request = (lyricsRequests.get(track.id) || 0) + 1;
  lyricsRequests.set(track.id, request);
  track.lyricsStatus = "searching";
  lyricsMatches.set(track.id, {
    status: "searching",
    message: alternativeTitle ? `Buscando por “${alternativeTitle}”.` : `Buscando por “${track.title || track.fileName}”.`
  });
  updateLyricsStatusUI(track);
  try {
    const result = await window.juice.findLyrics(lyricsLookupPayload(track, alternativeTitle));
    if (lyricsRequests.get(track.id) !== request || !state.tracks.includes(track)) return null;
    if (alternativeTitle) result.searchTitle = alternativeTitle;
    lyricsMatches.set(track.id, result);
    if (result.status === "matched" && result.match?.lyrics) {
      track.lyrics = result.match.lyrics;
      track.lyricsStatus = "ready";
    } else if (result.status === "ambiguous") {
      track.lyricsStatus = "review";
    } else {
      track.lyricsStatus = "missing";
    }
    updateLyricsStatusUI(track);
    return result;
  } catch (error) {
    if (lyricsRequests.get(track.id) !== request || !state.tracks.includes(track)) return null;
    const result = { status: "error", message: error.message, candidates: [], searchTitle: alternativeTitle };
    lyricsMatches.set(track.id, result);
    track.lyricsStatus = "error";
    updateLyricsStatusUI(track);
    return result;
  }
}

async function searchLyricsAlternative() {
  const track = selectedTrack();
  const input = elements.lyricsMatch.querySelector("#lyrics-alternative-title");
  const title = input?.value.trim() || "";
  if (!track || title.length < 2) {
    toast("Informe outro título", "Digite pelo menos dois caracteres para pesquisar.", "error");
    input?.focus();
    return;
  }
  await lookupLyrics(track, title);
}

async function searchLyricsForSelectedTrack() {
  const track = selectedTrack();
  if (!track) return;
  elements.lyricsSearch.disabled = true;
  elements.lyricsSearch.textContent = "Buscando...";
  try {
    await lookupLyrics(track);
  } finally {
    elements.lyricsSearch.disabled = false;
    elements.lyricsSearch.textContent = "Buscar na API";
  }
}

async function searchLyricsForAllTracks() {
  if (state.lyricsBulkRunning || !state.tracks.length) return;
  const pending = state.tracks.filter((track) => !String(track.lyrics || "").trim());
  if (!pending.length) {
    toast("Letras já preenchidas", "Não há músicas sem letra para pesquisar.");
    return;
  }
  state.lyricsBulkRunning = true;
  elements.lyricsSearchAll.disabled = true;
  elements.lyricsSearch.disabled = true;
  let completed = 0;
  let cursor = 0;
  const counts = { ready: 0, review: 0, missing: 0, error: 0 };
  const worker = async () => {
    while (cursor < pending.length) {
      const track = pending[cursor++];
      await lookupLyrics(track);
      counts[track.lyricsStatus] = (counts[track.lyricsStatus] || 0) + 1;
      completed += 1;
      elements.lyricsSearchAll.textContent = `Buscando ${completed}/${pending.length}`;
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(2, pending.length) }, worker));
    const parts = [
      counts.ready && `${counts.ready} preenchida(s)`,
      counts.review && `${counts.review} para revisar`,
      counts.missing && `${counts.missing} sem resultado`,
      counts.error && `${counts.error} com erro`
    ].filter(Boolean);
    toast("Busca de letras concluída", parts.join(" · ") || "Nenhuma alteração foi necessária.", counts.error ? "error" : "success");
  } finally {
    state.lyricsBulkRunning = false;
    elements.lyricsSearchAll.textContent = "Buscar letras";
    elements.lyricsSearchAll.disabled = !state.tracks.length;
    elements.lyricsSearch.disabled = !selectedTrack();
  }
}

async function applyLyricsCandidate(candidateId) {
  const track = selectedTrack();
  const result = track ? lyricsMatches.get(track.id) : null;
  if (!track || result?.status !== "ambiguous" || !result.candidates?.some((candidate) => String(candidate.id) === String(candidateId))) return;
  try {
    const match = await window.juice.getLyricsCandidate(candidateId);
    track.lyrics = match.lyrics;
    track.lyricsStatus = "ready";
    lyricsMatches.set(track.id, { status: "manual", match: { ...match, reason: "Selecionada manualmente para revisão." } });
    updateLyricsStatusUI(track);
    toast("Letra selecionada", "Revise o texto antes de salvar a música.");
  } catch (error) {
    toast("Não foi possível obter a letra", error.message, "error");
  }
}

async function chooseCover() {
  const track = selectedTrack();
  if (!track) return;
  try {
    const cover = await window.juice.chooseCover();
    if (!cover) return;
    track.coverPath = cover.path;
    track.coverDataUrl = cover.dataUrl;
    track.coverSource = "manual";
    renderTracks();
  } catch (error) {
    toast("Capa não adicionada", error.message, "error");
  }
}

function renderEditorCoverResults() {
  elements.editorCoverResults.innerHTML = state.editorCoverResults.length
    ? state.editorCoverResults.map((cover, index) => `
      <article class="editor-result-card">
        <button class="editor-result-preview" type="button" data-editor-cover-preview="${index}" title="Carregar prévia"><i data-lucide="image"></i></button>
        <div><strong>${escapeHtml(cover.name.replace(/\.[^.]+$/, ""))}</strong><span>${escapeHtml([cover.creator ? `por ${cover.creator}` : "", cover.sizeHuman, (cover.extension || "").replace(".", "").toUpperCase()].filter(Boolean).join(" · "))}</span></div>
        <button class="btn btn-primary btn-sm" type="button" data-editor-cover-use="${index}">Usar capa</button>
      </article>
    `).join("")
    : '<div class="editor-result-empty">Nenhuma capa encontrada para esta pesquisa.</div>';
  refreshIcons();
}

async function searchEditorCovers() {
  const query = elements.editorCoverQuery.value.trim();
  if (query.length < 2) {
    toast("Informe uma capa", "Digite pelo menos dois caracteres para pesquisar.", "error");
    return;
  }
  elements.editorCoverSubmit.disabled = true;
  elements.editorCoverSubmit.textContent = "Buscando...";
  elements.editorCoverResults.innerHTML = '<div class="editor-result-empty"><span class="loading loading-spinner loading-sm"></span> Consultando covers...</div>';
  try {
    const data = await window.juice.searchEditorCovers(query, 1);
    state.editorCoverResults = (data.items || []).filter((item) => item.type === "file").slice(0, 12);
    renderEditorCoverResults();
  } catch (error) {
    elements.editorCoverResults.innerHTML = `<div class="editor-result-empty error">${escapeHtml(error.message)}</div>`;
  } finally {
    elements.editorCoverSubmit.disabled = false;
    elements.editorCoverSubmit.textContent = "Buscar";
  }
}

async function useEditorCover(index) {
  const track = selectedTrack();
  const cover = state.editorCoverResults[index];
  if (!track || !cover) return;
  const button = elements.editorCoverResults.querySelector(`[data-editor-cover-use="${index}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = "Aplicando...";
  }
  try {
    const applied = await window.juice.applyEditorCover({
      filePath: track.path,
      title: track.title,
      currentCoverPath: track.coverPath,
      cover
    });
    track.coverPath = applied.path;
    track.coverDataUrl = applied.dataUrl;
    track.coverSource = "manual";
    renderTracks();
    toast("Capa aplicada", "A imagem foi salva na pasta covers desta música.");
  } catch (error) {
    toast("Capa não aplicada", error.message, "error");
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = "Usar capa";
    }
  }
}

function renderEditorOriginalResults() {
  elements.editorOriginalResults.innerHTML = state.editorOriginalResults.length
    ? state.editorOriginalResults.map((original, index) => `
      <article class="editor-result-card original-result-card">
        <span class="editor-original-type">${escapeHtml((original.extension || "").replace(".", "").toUpperCase() || "ÁUDIO")}</span>
        <div><strong>${escapeHtml(original.fileName || original.name)}</strong><span>${escapeHtml([original.era, original.duration, original.sizeHuman].filter(Boolean).join(" · "))}</span></div>
        <button class="btn btn-primary btn-sm" type="button" data-editor-original-compare="${index}">Validar</button>
      </article>
    `).join("")
    : '<div class="editor-result-empty">Nenhum arquivo original encontrado para este título.</div>';
}

async function searchEditorOriginals() {
  const query = elements.editorOriginalQuery.value.trim();
  if (query.length < 2) {
    toast("Informe um título", "Digite pelo menos dois caracteres para pesquisar Original Files.", "error");
    return;
  }
  elements.editorOriginalSubmit.disabled = true;
  elements.editorOriginalSubmit.textContent = "Buscando...";
  elements.editorOriginalResults.innerHTML = '<div class="editor-result-empty"><span class="loading loading-spinner loading-sm"></span> Procurando originais...</div>';
  elements.editorOriginalComparison.classList.add("hidden");
  try {
    const data = await window.juice.searchOriginals(query, 1);
    state.editorOriginalResults = (data.results || []).slice(0, 12);
    renderEditorOriginalResults();
  } catch (error) {
    elements.editorOriginalResults.innerHTML = `<div class="editor-result-empty error">${escapeHtml(error.message)}</div>`;
  } finally {
    elements.editorOriginalSubmit.disabled = false;
    elements.editorOriginalSubmit.textContent = "Buscar";
  }
}

function comparisonMetrics(value) {
  return [
    String(value.codec || "").toUpperCase(),
    value.sampleRate ? `${(value.sampleRate / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kHz` : "",
    value.bits ? `${value.bits}-bit` : "",
    value.bitRate ? `${Math.round(value.bitRate / 1000)} kbps` : "",
    value.duration ? formatDuration(value.duration) : ""
  ].filter(Boolean).join(" · ");
}

function renderOriginalComparison(original, result) {
  const statusLabel = result.status === "verified" ? "Confirmado" : result.status === "suspect" ? "Suspeito" : "Revisar";
  elements.editorOriginalComparison.className = `original-comparison ${result.status}`;
  elements.editorOriginalComparison.innerHTML = `
    <div class="original-comparison-head">
      <span class="badge ${result.status === "verified" ? "badge-success" : result.status === "suspect" ? "badge-error" : "badge-warning"}">${statusLabel}</span>
      <div><strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.reason)}</span></div>
    </div>
    <div class="original-name"><span>Nome do arquivo original</span><strong>${escapeHtml(original.fileName || original.name)}</strong><small>${escapeHtml(original.path || "")}</small></div>
    <div class="comparison-grid">
      <div><span>Seu arquivo</span><strong>${escapeHtml(comparisonMetrics(result.local))}</strong><small>${escapeHtml(result.local.qualityReason || "")}</small></div>
      <div><span>Original da API</span><strong>${escapeHtml(comparisonMetrics(result.original))}</strong><small>${escapeHtml(result.original.qualityReason || "")}</small></div>
    </div>
    <p class="comparison-footnote">${result.exactAudio ? "A assinatura ignora metadados e confirma o conteúdo de áudio. Em ALAC/M4A vindo de WAV, a comparação é feita no PCM decodificado para provar que não houve perda." : `Diferença de duração: ${Number(result.durationDifference || 0).toFixed(2)} s. Uma correspondência de título isolada não certifica o arquivo.`}</p>
  `;
}

async function compareEditorOriginal(index) {
  const track = selectedTrack();
  const original = state.editorOriginalResults[index];
  if (!track || !original) return;
  const button = elements.editorOriginalResults.querySelector(`[data-editor-original-compare="${index}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = "Validando...";
  }
  elements.editorOriginalComparison.className = "original-comparison checking";
  elements.editorOriginalComparison.innerHTML = '<span class="loading loading-spinner loading-sm"></span><div><strong>Comparando com o original</strong><span>Baixando temporariamente e calculando as assinaturas do áudio...</span></div>';
  try {
    const result = await window.juice.compareOriginal(track.path, original);
    track.originalComparison = { original, result };
    renderOriginalComparison(original, result);
  } catch (error) {
    elements.editorOriginalComparison.className = "original-comparison suspect";
    elements.editorOriginalComparison.innerHTML = `<strong>Não foi possível validar</strong><span>${escapeHtml(error.message)}</span>`;
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = "Validar";
    }
  }
}

async function saveAll() {
  if (!state.tracks.length || state.processing) return;
  state.processing = true;
  elements.saveAll.disabled = true;
  setLoading(true, "Salvando alterações", "Preparando a primeira música...");
  try {
    const results = await window.juice.processTracks(state.tracks);
    const succeeded = results.filter((result) => result.ok);
    const failed = results.filter((result) => !result.ok);
    state.tracks = state.tracks.filter((track) => failed.some((result) => result.id === track.id));
    state.selectedId = state.tracks[0]?.id || null;
    renderTracks();
    if (succeeded.length) toast("Alterações salvas", `${succeeded.length} ${succeeded.length === 1 ? "música foi atualizada" : "músicas foram atualizadas"}.`);
    for (const failure of failed.slice(0, 3)) toast("Falha ao salvar", failure.error, "error");
  } catch (error) {
    toast("Não foi possível salvar", error.message, "error");
  } finally {
    state.processing = false;
    setLoading(false);
    renderTracks();
  }
}

function catalogFilters() {
  return {
    era: elements.catalogEra.value,
    format: elements.catalogFormat.value
  };
}

async function loadCatalogFilterOptions() {
  if (state.catalogFiltersLoaded || state.catalogFiltersLoading) return;
  state.catalogFiltersLoading = true;
  try {
    const data = await window.juice.catalogFilterOptions();
    const eraOptions = (data.eras || [])
      .map((era) => {
        if (typeof era === "string") return { value: era, label: era };
        return {
          value: era.slug || era.value || era.name || "",
          label: era.name || era.label || era.slug || era.value || ""
        };
      })
      .filter((era) => era.value);
    elements.catalogEra.innerHTML = [
      '<option value="">Todas</option>',
      ...eraOptions.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    ].join("");
    state.catalogFiltersLoaded = true;
  } catch (error) {
    toast("Filtros indisponíveis", error.message, "error");
  } finally {
    state.catalogFiltersLoading = false;
  }
}

async function loadCatalog(page = 1) {
  const query = elements.catalogSearch.value.trim();
  if (query.length === 1) {
    elements.catalogGrid.innerHTML = "";
    elements.catalogCount.textContent = "";
    elements.catalogEmpty.classList.remove("hidden");
    elements.catalogEmpty.querySelector("h3").textContent = "Pesquise uma música";
    elements.catalogEmpty.querySelector("p").textContent = "Digite pelo menos dois caracteres ou use somente os filtros.";
    return;
  }
  state.catalogPage = page;
  state.catalogQuery = query;
  elements.catalogGrid.innerHTML = "";
  elements.catalogEmpty.classList.add("hidden");
  setLoading(true, "Buscando músicas", query ? `Procurando por “${query}”...` : "Aplicando os filtros...");
  try {
    const data = await window.juice.searchCatalog(query, page, catalogFilters());
    state.catalogData = data;
    renderCatalog(data);
  } catch (error) {
    elements.catalogEmpty.classList.remove("hidden");
    elements.catalogEmpty.querySelector("h3").textContent = "Catálogo indisponível";
    elements.catalogEmpty.querySelector("p").textContent = error.message;
  } finally {
    setLoading(false);
  }
}

function catalogSelectionKey(song) {
  return String(song?.path || song?.id || "");
}

function updateCatalogBatch() {
  const downloadable = (state.catalogData?.results || []).filter((song) => song.path);
  const selectedCount = state.catalogSelected.size;
  const allPageSelected =
    downloadable.length > 0 &&
    downloadable.every((song) => state.catalogSelected.has(catalogSelectionKey(song)));
  elements.catalogBatch.classList.toggle("hidden", !downloadable.length && !selectedCount);
  elements.catalogSelectedCount.textContent =
    `${selectedCount} ${selectedCount === 1 ? "selecionada" : "selecionadas"}`;
  elements.catalogSelectPage.textContent = allPageSelected ? "Desmarcar página" : "Selecionar página";
  elements.catalogClearSelection.classList.toggle("hidden", !selectedCount);
  elements.catalogDownloadSelected.classList.toggle("hidden", !selectedCount);
  elements.catalogDownloadSelected.disabled = state.catalogQueueRunning || !selectedCount;
}

async function downloadSelectedCatalog() {
  if (state.catalogQueueRunning || !state.catalogSelected.size) return;
  state.catalogQueueRunning = true;
  elements.catalogDownloadSelected.disabled = true;
  elements.catalogDownloadSelected.textContent = "Baixando...";
  elements.catalogQueueProgress.classList.remove("hidden");
  elements.catalogQueueLabel.textContent = "Preparando fila...";
  elements.catalogQueueBar.style.width = "0%";
  try {
    const result = await window.juice.downloadQueue([...state.catalogSelected.values()]);
    if (!result) return;
    const succeeded = result.results.filter((item) => item.ok);
    const failed = result.results.filter((item) => !item.ok);
    succeeded.forEach((item) => state.catalogSelected.delete(String(item.path || item.id)));
    renderCatalog(state.catalogData);
    if (succeeded.length) {
      toast(
        "Fila concluída",
        `${succeeded.length} ${succeeded.length === 1 ? "música foi salva" : "músicas foram salvas"} em ${result.directory}.`
      );
    }
    if (failed.length) {
      toast(
        "Alguns downloads falharam",
        `${failed.length} ${failed.length === 1 ? "música permanece selecionada" : "músicas permanecem selecionadas"} para tentar novamente.`,
        "error"
      );
    }
  } catch (error) {
    toast("Fila indisponível", error.message, "error");
  } finally {
    state.catalogQueueRunning = false;
    elements.catalogDownloadSelected.textContent = "Baixar selecionadas";
    elements.catalogQueueProgress.classList.add("hidden");
    updateCatalogBatch();
  }
}

function renderCatalog(data) {
  const visibleCount = data.results.length;
  elements.catalogCount.textContent = data.count === visibleCount
    ? `${visibleCount.toLocaleString("pt-BR")} ${visibleCount === 1 ? "resultado" : "resultados"}`
    : `${visibleCount.toLocaleString("pt-BR")} ${visibleCount === 1 ? "música" : "músicas"} nesta página`;
  elements.catalogEmpty.classList.toggle("hidden", data.results.length > 0);
  elements.catalogGrid.innerHTML = data.results
    .map(
      (song, index) => `
        <article class="simple-result catalog-result ${state.catalogSelected.has(catalogSelectionKey(song)) ? "selected" : ""}">
          <label class="catalog-check" title="${song.path ? "Selecionar para baixar" : "Arquivo indisponível"}">
            <input type="checkbox" data-catalog-select="${index}" ${state.catalogSelected.has(catalogSelectionKey(song)) ? "checked" : ""} ${song.path ? "" : "disabled"} />
            <span></span>
          </label>
          <span class="simple-result-icon">♫</span>
          <div class="simple-result-copy">
            <strong>${escapeHtml(song.name)}</strong>
            <span>${escapeHtml([song.era, song.category, song.duration, song.sizeHuman, song.source].filter(Boolean).join(" · "))}</span>
          </div>
          <div class="simple-result-actions">
            <button class="button secondary" data-tracker="${index}">Tracker</button>
            ${song.audioUrl ? `<button class="button secondary" data-play="${index}">Ouvir</button>` : ""}
            ${song.path ? `<button class="button primary" data-download="${index}">Baixar</button>` : ""}
          </div>
        </article>
      `
    )
    .join("");
  elements.pagination.classList.toggle("hidden", !data.next && !data.previous);
  elements.catalogPrev.disabled = !data.previous;
  elements.catalogNext.disabled = !data.next;
  elements.catalogPage.textContent = `Página ${state.catalogPage}`;
  updateCatalogBatch();
}

async function loadCovers(page = 1) {
  const request = ++state.coversRequest;
  state.coversPage = page;
  state.coversQuery = elements.coversSearch.value.trim();
  if (state.coversQuery.length < 2) {
    elements.coversGrid.innerHTML = "";
    elements.coversCount.textContent = "";
    elements.coversEmpty.classList.remove("hidden");
    elements.coversEmpty.querySelector("h3").textContent = "Pesquise uma capa";
    elements.coversEmpty.querySelector("p").textContent = "Digite pelo menos dois caracteres para consultar a API.";
    elements.coversPagination.classList.add("hidden");
    return;
  }
  elements.coversGrid.innerHTML = "";
  elements.coversEmpty.classList.add("hidden");
  setLoading(true, "Buscando capas", `Procurando por “${state.coversQuery}”...`);
  try {
    const data = await window.juice.searchCovers(state.coversQuery, page);
    if (request !== state.coversRequest) return;
    const simplified = { ...data, items: data.items.filter((item) => item.type === "file").slice(0, 18) };
    state.coversData = simplified;
    renderCovers(simplified);
  } catch (error) {
    if (request !== state.coversRequest) return;
    elements.coversEmpty.classList.remove("hidden");
    elements.coversEmpty.querySelector("h3").textContent = "Covers indisponíveis";
    elements.coversEmpty.querySelector("p").textContent = error.message;
  } finally {
    if (request === state.coversRequest) setLoading(false);
  }
}

function renderCoversBreadcrumbs(currentPath) {
  const parts = String(currentPath || "").split("/").filter(Boolean);
  const crumbs = [];
  let accumulated = "";
  for (const part of parts) {
    accumulated = accumulated ? `${accumulated}/${part}` : part;
    crumbs.push({ label: part === "Cover Arts" ? "Todas as coleções" : part, path: accumulated });
  }
  elements.coversBreadcrumbs.innerHTML = crumbs
    .map(
      (crumb, index) => `
        <span class="breadcrumb">
          ${index ? "<i>›</i>" : ""}
          <button data-cover-breadcrumb="${escapeHtml(crumb.path)}">${escapeHtml(crumb.label)}</button>
        </span>
      `
    )
    .join("");
}

function renderCovers(data) {
  const files = data.items.filter((item) => item.type === "file").slice(0, 18);
  elements.coversBreadcrumbs.innerHTML = "";
  elements.coversCount.textContent = `${data.totalFiles.toLocaleString("pt-BR")} ${data.totalFiles === 1 ? "resultado" : "resultados"}`;
  elements.coversEmpty.classList.toggle("hidden", files.length > 0);
  elements.coversGrid.className = "simple-results";
  elements.coversGrid.innerHTML = files
    .map((item, index) => {
      return `
        <article class="simple-result cover-search-result" data-cover-index="${index}">
          <span class="simple-result-icon cover-result-preview">▧</span>
          <div class="simple-result-copy">
            <strong>${escapeHtml(item.name.replace(/\.[^.]+$/, ""))}</strong>
            <span>${escapeHtml([
              item.creator ? `Capa por ${item.creator}` : "",
              (item.extension || "").replace(".", "").toUpperCase(),
              item.sizeHuman
            ].filter(Boolean).join(" · "))}</span>
          </div>
          <div class="simple-result-actions">
            <button class="button secondary" data-cover-action="preview">Visualizar</button>
            <button class="button primary" data-cover-action="download">Baixar</button>
          </div>
        </article>
      `;
    })
    .join("");
  elements.coversPagination.classList.toggle("hidden", data.pageCount <= 1);
  elements.coversPrev.disabled = data.page <= 1;
  elements.coversNext.disabled = !data.hasMore;
  elements.coversPage.textContent = `Página ${data.page} de ${data.pageCount}`;
}

function updateCoverViewTransform() {
  elements.coverViewerImage.style.transform =
    `translate(-50%, -50%) scale(${coverView.scale})`;
  elements.coverZoomReset.textContent = `${Math.round(coverView.scale * 100)}%`;
  elements.coverViewerStage.classList.toggle("zoomed", coverView.scale > 1);
}

function setCoverZoom(nextScale) {
  coverView.scale = Math.min(3, Math.max(1, Number(nextScale) || 1));
  updateCoverViewTransform();
}

function openCoverViewer(item, details) {
  coverView.scale = 1;
  elements.coverViewerTitle.textContent = item.name.replace(/\.[^.]+$/, "");
  elements.coverViewerCreator.textContent = item.creator ? `Capa por ${item.creator}` : "";
  elements.coverViewerImage.src = details.dataUrl;
  elements.coverViewerImage.alt = item.name;
  elements.coverInfoDimensions.textContent =
    `${details.width.toLocaleString("pt-BR")} × ${details.height.toLocaleString("pt-BR")} px`;
  elements.coverInfoFormat.textContent =
    (item.extension || details.mimeType.split("/")[1] || "imagem").replace(".", "").toUpperCase();
  elements.coverInfoSize.textContent = item.sizeHuman || formatBytes(details.bytes);
  updateCoverViewTransform();
  elements.coverViewerBackdrop.classList.remove("hidden");
  elements.coverViewer.classList.remove("hidden");
}

function closeCoverViewer() {
  elements.coverViewerBackdrop.classList.add("hidden");
  elements.coverViewer.classList.add("hidden");
  elements.coverViewerImage.removeAttribute("src");
}

function hydrateCoverThumbnails() {
  coverObserver?.disconnect();
  coverThumbnailGeneration += 1;
  coverThumbnailQueue = [];
  const generation = coverThumbnailGeneration;
  const images = [...elements.coversGrid.querySelectorAll("[data-cover-thumbnail]")];
  const queueImage = (image) => {
    if (image.dataset.queued) return;
    image.dataset.queued = "true";
    coverThumbnailQueue.push({ image, generation });
    pumpCoverThumbnailQueue();
  };

  function pumpCoverThumbnailQueue() {
    while (activeCoverThumbnailLoads < 2 && coverThumbnailQueue.length) {
      const job = coverThumbnailQueue.shift();
      if (job.generation !== coverThumbnailGeneration || !job.image.isConnected) continue;
      activeCoverThumbnailLoads += 1;
      window.juice.coverThumbnail(job.image.dataset.coverThumbnail)
        .then((dataUrl) => {
          if (job.generation !== coverThumbnailGeneration || !job.image.isConnected) return;
          job.image.src = dataUrl;
          job.image.classList.add("loaded");
          job.image.nextElementSibling?.classList.add("hidden");
        })
        .catch(() => {
          if (job.generation === coverThumbnailGeneration && job.image.isConnected) {
            job.image.closest(".cover-image")?.classList.add("thumbnail-error");
          }
        })
        .finally(() => {
          activeCoverThumbnailLoads -= 1;
          pumpCoverThumbnailQueue();
        });
    }
  }

  if (!("IntersectionObserver" in window)) {
    images.forEach(queueImage);
    return;
  }
  coverObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      coverObserver?.unobserve(entry.target);
      queueImage(entry.target);
    });
  }, { rootMargin: "220px" });
  images.forEach((image) => coverObserver.observe(image));
}

function playSong(song) {
  elements.playerCover.src = song.imageUrl || "../assets/icon.png";
  elements.playerTitle.textContent = song.name;
  elements.playerArtist.textContent = song.artists;
  elements.audioPlayer.src = song.audioUrl;
  elements.miniPlayer.classList.remove("hidden");
  elements.audioPlayer.play().catch(() => toast("Reprodução pronta", "Use o botão play para iniciar."));
}

async function downloadSong(song) {
  try {
    setLoading(true, "Baixando música", song.name);
    const output = await window.juice.downloadSong(song);
    if (output) toast("Download concluído", `Arquivo salvo em ${output}`);
  } catch (error) {
    toast("Download indisponível", error.message, "error");
  } finally {
    setLoading(false);
  }
}

async function loadTracker() {
  const query = elements.trackerSearch.value.trim();
  if (query.length < 2) {
    elements.trackerList.innerHTML = "";
    elements.trackerCount.textContent = "";
    elements.trackerEmpty.classList.remove("hidden");
    elements.trackerEmpty.querySelector("h3").textContent = "Pesquise uma música";
    elements.trackerEmpty.querySelector("p").textContent = "Digite pelo menos dois caracteres para consultar o tracker.";
    return;
  }
  setLoading(true, "Consultando tracker", `Procurando por “${query}”...`);
  try {
    const rows = await window.juice.searchTracker(query);
    renderTracker(rows);
  } catch (error) {
    elements.trackerEmpty.classList.remove("hidden");
    elements.trackerEmpty.querySelector("h3").textContent = "Tracker indisponível";
    elements.trackerEmpty.querySelector("p").textContent = error.message;
  } finally {
    setLoading(false);
  }
}

async function openSongInTracker(song) {
  const query = String(song?.name || "")
    .replace(/^juice\s+wrld\s*[-–—]\s*/i, "")
    .trim();
  if (!query) return;
  elements.catalogTrackerQuery.textContent = query;
  elements.catalogTrackerContent.innerHTML = `
    <div class="tracker-drawer-state">
      <div class="spinner"></div>
      <strong>Consultando o tracker</strong>
      <span>Buscando os dados de “${escapeHtml(query)}”...</span>
    </div>
  `;
  elements.catalogTrackerBackdrop.classList.remove("hidden");
  elements.catalogTrackerDrawer.classList.remove("hidden");
  try {
    const rows = await window.juice.searchTracker(query);
    if (!rows.length) {
      elements.catalogTrackerContent.innerHTML = `
        <div class="tracker-drawer-state">
          <strong>Nenhuma correspondência encontrada</strong>
          <span>Tente pesquisar esta música diretamente na aba Tracker.</span>
        </div>
      `;
      return;
    }
    elements.catalogTrackerContent.innerHTML = rows.slice(0, 10).map(trackerCardMarkup).join("");
  } catch (error) {
    elements.catalogTrackerContent.innerHTML = `
      <div class="tracker-drawer-state error">
        <strong>Tracker indisponível</strong>
        <span>${escapeHtml(error.message)}</span>
      </div>
    `;
  }
}

function closeCatalogTracker() {
  elements.catalogTrackerBackdrop.classList.add("hidden");
  elements.catalogTrackerDrawer.classList.add("hidden");
}

function renderTracker(rows) {
  rows = rows.slice(0, 10);
  elements.trackerCount.textContent = `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`;
  elements.trackerEmpty.classList.toggle("hidden", rows.length > 0);
  elements.trackerList.innerHTML = rows.map(trackerCardMarkup).join("");
}

function trackerCardMarkup(row) {
  return `
    <article class="tracker-card">
      <div class="tracker-card-head">
        <div class="tracker-title"><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.artists || "Juice WRLD")}</p></div>
        <div class="tracker-tags">${row.era ? `<span>${escapeHtml(row.era)}</span>` : ""}${row.category ? `<span>${escapeHtml(row.category)}</span>` : ""}</div>
      </div>
      ${
        row.aliases?.length
          ? `<div class="alias-list">${row.aliases.map((alias) => `<span>${escapeHtml(alias)}</span>`).join("")}</div>`
          : ""
      }
      <div class="tracker-detail-grid">
        ${trackerDetail("Composição / créditos", row.composers, "wide")}
        ${trackerDetail("Participações", row.participations)}
        ${trackerDetail("Instrumental", row.instrumentals, "wide")}
        ${trackerDetail("Produção", row.producers)}
        ${trackerDetail("Engenharia", row.engineers)}
        ${trackerDetail("Data de gravação", row.recordDates)}
        ${trackerDetail("Preview", row.previewDate)}
        ${trackerDetail("Lançamento / vazamento", row.releaseDate)}
        ${trackerDetail("Duração", row.length)}
        ${trackerDetail("Arquivos disponíveis", row.availableFiles, "wide")}
        ${trackerDetail("Nome(s) do arquivo", row.fileNames, "wide")}
        ${trackerDetail("Local de gravação", row.recordingLocations)}
      </div>
      ${row.information ? `<p class="tracker-more">${escapeHtml(row.information)}</p>` : ""}
    </article>
  `;
}

function trackerDetail(label, value, className = "") {
  if (!String(value || "").trim()) return "";
  return `<div class="tracker-detail ${className}"><label>${escapeHtml(label)}</label><span>${escapeHtml(value)}</span></div>`;
}

elements.nav.forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
elements.addMusic.addEventListener("click", addMusic);
elements.emptyAdd.addEventListener("click", addMusic);
elements.removeSelected.addEventListener("click", () => state.selectedId && removeTrack(state.selectedId));
elements.saveAll.addEventListener("click", saveAll);
elements.coverControl.addEventListener("click", chooseCover);
elements.coverControl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") chooseCover();
});
elements.trackList.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    event.stopPropagation();
    removeTrack(remove.dataset.remove);
    return;
  }
  const row = event.target.closest("[data-id]");
  if (row) {
    state.selectedId = row.dataset.id;
    renderTracks();
  }
});
elements.form.addEventListener("input", (event) => {
  const track = selectedTrack();
  if (!track || !event.target.name) return;
  track[event.target.name] = event.target.value;
  if (event.target.name === "title") {
    elements.selectedTitle.textContent = event.target.value || "Sem título";
    lyricsRequests.set(track.id, (lyricsRequests.get(track.id) || 0) + 1);
    lyricsMatches.delete(track.id);
    track.lyricsStatus = track.lyrics ? "review" : "idle";
    renderLyricsMatch(track);
  }
  if (event.target.name === "lyrics") {
    track.lyricsStatus = event.target.value.trim() ? "ready" : "idle";
    renderLyricsFormatting(track);
  }
  const selectedRow = elements.trackList.querySelector(`[data-id="${track.id}"] .row-copy strong`);
  if (selectedRow && event.target.name === "title") selectedRow.textContent = event.target.value || track.fileName;
  if (event.target.name === "title" || event.target.name === "lyrics") updateLyricsStatusUI(track);
});
elements.lyricsSearchAll.addEventListener("click", searchLyricsForAllTracks);
elements.lyricsSearch.addEventListener("click", searchLyricsForSelectedTrack);
elements.lyricsMatch.addEventListener("click", (event) => {
  const candidate = event.target.closest("[data-lyrics-candidate]");
  if (candidate) applyLyricsCandidate(candidate.dataset.lyricsCandidate);
  if (event.target.closest("[data-lyrics-alternative]")) searchLyricsAlternative();
});
elements.lyricsMatch.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("#lyrics-alternative-title")) {
    event.preventDefault();
    searchLyricsAlternative();
  }
});
elements.lyricsFormat.addEventListener("click", (event) => {
  if (!event.target.closest("[data-format-lyrics]")) return;
  const track = selectedTrack();
  if (!track) return;
  track.lyrics = safelyFormatLyrics(track.lyrics);
  elements.form.elements.lyrics.value = track.lyrics;
  renderLyricsFormatting(track);
  toast("Formatação ajustada", "Espaços, estrofes, maiúsculas e pontuação final foram normalizados para revisão.");
});
elements.editorCoverSubmit.addEventListener("click", searchEditorCovers);
elements.editorCoverQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchEditorCovers();
  }
});
elements.editorCoverResults.addEventListener("click", async (event) => {
  const use = event.target.closest("[data-editor-cover-use]");
  if (use) {
    await useEditorCover(Number(use.dataset.editorCoverUse));
    return;
  }
  const previewButton = event.target.closest("[data-editor-cover-preview]");
  if (!previewButton) return;
  const cover = state.editorCoverResults[Number(previewButton.dataset.editorCoverPreview)];
  if (!cover) return;
  previewButton.disabled = true;
  try {
    const preview = cover.previewDetails || await window.juice.coverPreview(cover.path);
    cover.previewDetails = preview;
    previewButton.innerHTML = `<img src="${preview.dataUrl}" alt="" />`;
  } catch (error) {
    toast("Prévia indisponível", error.message, "error");
  } finally {
    previewButton.disabled = false;
  }
});
elements.editorOriginalSubmit.addEventListener("click", searchEditorOriginals);
elements.editorOriginalQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchEditorOriginals();
  }
});
elements.editorOriginalResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-editor-original-compare]");
  if (button) compareEditorOriginal(Number(button.dataset.editorOriginalCompare));
});
elements.formatButtons.forEach((button) =>
  button.addEventListener("click", () => {
    const track = selectedTrack();
    if (!track) return;
    track.outputMode = button.dataset.format;
    renderInspector();
  })
);
elements.catalogSubmit.addEventListener("click", () => loadCatalog(1));
elements.catalogSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadCatalog(1);
});
elements.catalogPrev.addEventListener("click", () => loadCatalog(Math.max(1, state.catalogPage - 1)));
elements.catalogNext.addEventListener("click", () => loadCatalog(state.catalogPage + 1));
elements.catalogGrid.addEventListener("click", (event) => {
  const tracker = event.target.closest("[data-tracker]");
  const play = event.target.closest("[data-play]");
  const download = event.target.closest("[data-download]");
  if (tracker) openSongInTracker(state.catalogData.results[Number(tracker.dataset.tracker)]);
  if (play) playSong(state.catalogData.results[Number(play.dataset.play)]);
  if (download) downloadSong(state.catalogData.results[Number(download.dataset.download)]);
});
elements.catalogGrid.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-catalog-select]");
  if (!checkbox || !state.catalogData) return;
  const song = state.catalogData.results[Number(checkbox.dataset.catalogSelect)];
  const key = catalogSelectionKey(song);
  if (checkbox.checked) state.catalogSelected.set(key, song);
  else state.catalogSelected.delete(key);
  checkbox.closest(".catalog-result")?.classList.toggle("selected", checkbox.checked);
  updateCatalogBatch();
});
elements.catalogSelectPage.addEventListener("click", () => {
  const downloadable = (state.catalogData?.results || []).filter((song) => song.path);
  const allSelected =
    downloadable.length > 0 &&
    downloadable.every((song) => state.catalogSelected.has(catalogSelectionKey(song)));
  downloadable.forEach((song) => {
    const key = catalogSelectionKey(song);
    if (allSelected) state.catalogSelected.delete(key);
    else state.catalogSelected.set(key, song);
  });
  renderCatalog(state.catalogData);
});
elements.catalogClearSelection.addEventListener("click", () => {
  if (state.catalogQueueRunning) return;
  state.catalogSelected.clear();
  renderCatalog(state.catalogData);
});
elements.catalogDownloadSelected.addEventListener("click", downloadSelectedCatalog);
elements.closeCatalogTracker.addEventListener("click", closeCatalogTracker);
elements.catalogTrackerBackdrop.addEventListener("click", closeCatalogTracker);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.catalogTrackerDrawer.classList.contains("hidden")) {
    closeCatalogTracker();
  }
  if (event.key === "Escape" && !elements.coverViewer.classList.contains("hidden")) {
    closeCoverViewer();
  }
});
elements.coversSubmit.addEventListener("click", () => loadCovers(1));
elements.coversSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadCovers(1);
});
elements.coversGrid.addEventListener("click", async (event) => {
  const card = event.target.closest("[data-cover-index]");
  if (!card || !state.coversData) return;
  const item = state.coversData.items[Number(card.dataset.coverIndex)];
  const action = event.target.closest("[data-cover-action]")?.dataset.coverAction;
  if (action === "download") {
    downloadSong(item);
  } else if (action === "preview") {
    const button = event.target.closest("[data-cover-action]");
    button.disabled = true;
    button.textContent = "Carregando...";
    setLoading(true, "Carregando miniatura", "Preparando uma versão leve da capa...");
    try {
      const details = item.previewDetails || await window.juice.coverPreview(item.path);
      if (!card.isConnected) return;
      item.previewDetails = details;
      card.querySelector(".cover-result-preview").innerHTML = `<img src="${details.dataUrl}" alt="" />`;
      button.textContent = "Atualizar";
    } catch (error) {
      toast("Capa indisponível", error.message, "error");
      button.textContent = "Tentar novamente";
    } finally {
      setLoading(false);
      if (button.isConnected) button.disabled = false;
    }
  } else if (event.target.closest(".cover-result-preview")) {
    setLoading(true, "Abrindo capa", "Preparando uma visualização leve...");
    try {
      const details = item.previewDetails || await window.juice.coverPreview(item.path);
      if (!card.isConnected) return;
      item.previewDetails = details;
      card.querySelector(".cover-result-preview").innerHTML = `<img src="${details.dataUrl}" alt="" />`;
      openCoverViewer(item, details);
    } catch (error) {
      toast("Capa indisponível", error.message, "error");
    } finally {
      setLoading(false);
    }
  }
});
elements.closeCoverViewer.addEventListener("click", closeCoverViewer);
elements.coverViewerBackdrop.addEventListener("click", closeCoverViewer);
elements.coverZoomIn.addEventListener("click", () => setCoverZoom(coverView.scale + 0.25));
elements.coverZoomOut.addEventListener("click", () => setCoverZoom(coverView.scale - 0.25));
elements.coverZoomReset.addEventListener("click", () => setCoverZoom(1));
elements.coverViewerStage.addEventListener("wheel", (event) => {
  event.preventDefault();
  setCoverZoom(coverView.scale + (event.deltaY < 0 ? 0.2 : -0.2));
}, { passive: false });
elements.coverViewerStage.addEventListener("dblclick", () => {
  setCoverZoom(coverView.scale > 1 ? 1 : 2);
});
elements.coversPrev.addEventListener("click", () => loadCovers(Math.max(1, state.coversPage - 1)));
elements.coversNext.addEventListener("click", () => loadCovers(state.coversPage + 1));
elements.trackerSubmit.addEventListener("click", loadTracker);
elements.trackerSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadTracker();
});
elements.qualityScan.addEventListener("click", startQualityScan);
elements.qualityCancel.addEventListener("click", cancelQualityScan);
elements.qualitySearch.addEventListener("input", debounce(() => {
  state.qualityPage = 1;
  renderQualityResults();
}, 160));
elements.qualityFilter.addEventListener("change", () => {
  state.qualityPage = 1;
  renderQualityResults();
});
elements.qualityPrev.addEventListener("click", () => {
  state.qualityPage = Math.max(1, state.qualityPage - 1);
  renderQualityResults();
});
elements.qualityNext.addEventListener("click", () => {
  state.qualityPage += 1;
  renderQualityResults();
});
elements.qualityList.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-quality-action]")?.dataset.qualityAction;
  const row = event.target.closest("[data-quality-index]");
  const item = row ? state.qualityResults[Number(row.dataset.qualityIndex)] : null;
  if (!action || !item) return;
  try {
    if (action === "spek") await window.juice.openInSpek(item.path);
    if (action === "folder") await window.juice.showQualityFile(item.path);
  } catch (error) {
    toast(action === "spek" ? "Spek não foi aberto" : "Pasta indisponível", error.message, "error");
  }
});
elements.closePlayer.addEventListener("click", () => {
  elements.audioPlayer.pause();
  elements.audioPlayer.removeAttribute("src");
  elements.miniPlayer.classList.add("hidden");
});
$("#open-api-docs").addEventListener("click", () => window.juice.openExternal("https://juicewrldapi.com/api-docs"));
$("#open-tracker").addEventListener("click", () =>
  window.juice.openExternal("https://docs.google.com/spreadsheets/d/1I6g2jrFdxIoYraZqnJ6NfivVHQXLmHR29rFvTAymE_E/edit?gid=1705371403")
);

window.juice.onProgress((progress) => {
  if (progress.done) return;
  const current = progress.index + 1;
  elements.loadingCopy.textContent = `${current} de ${progress.total} · ${progress.title}`;
  elements.progressBar.style.width = `${(current / progress.total) * 100}%`;
});

window.juice.onQueueProgress((progress) => {
  if (progress.done) {
    elements.catalogQueueLabel.textContent = "Fila concluída";
    elements.catalogQueueBar.style.width = "100%";
    return;
  }
  const current = progress.index + 1;
  elements.catalogQueueLabel.textContent = `${current} de ${progress.total} · ${progress.title}`;
  elements.catalogQueueBar.style.width = `${(current / progress.total) * 100}%`;
});

window.juice.onQualityProgress((progress) => {
  if (progress.phase === "found") {
    state.qualityRoot = progress.rootPath || "";
    elements.qualityProgressTitle.textContent = `${progress.total} ${progress.total === 1 ? "arquivo encontrado" : "arquivos encontrados"}`;
    elements.qualityProgressCopy.textContent = progress.total ? "Verificando codec e conteúdo espectral..." : "Nenhuma música encontrada na pasta Music.";
    return;
  }
  if (progress.phase === "item" || progress.phase === "items") {
    const received = progress.phase === "items"
      ? progress.items.map((entry) => entry.item)
      : [progress.item];
    state.qualityResults.push(...received);
    const latest = received[received.length - 1];
    elements.qualityProgressTitle.textContent = `${progress.completed} de ${progress.total}`;
    elements.qualityProgressCopy.textContent = latest?.relativePath || "";
    elements.qualityProgressBar.style.width = `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`;
    scheduleQualityRender();
  }
});

renderTracks();
