const { app, BrowserWindow, crashReporter, dialog, ipcMain, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const NodeID3 = require("node-id3");

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wma"]);
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const API_BASE = "https://juicewrldapi.com";
const SONGS_ENDPOINT = `${API_BASE}/juicewrld/songs/`;
const ERAS_ENDPOINT = `${API_BASE}/juicewrld/eras/`;
const FILE_ENDPOINT = `${API_BASE}/juicewrld/files/download/`;
const FILE_BROWSE_ENDPOINT = `${API_BASE}/juicewrld/files/browse/`;
const TRACKER_CSV =
  "https://docs.google.com/spreadsheets/d/1I6g2jrFdxIoYraZqnJ6NfivVHQXLmHR29rFvTAymE_E/gviz/tq?tqx=out:csv&gid=1705371403";
const ORIGINAL_ERA_PATHS = {
  jute: "Original Files/1. JUICED UP THE EP (Sessions)",
  juicethekidd: "Original Files/1. JUICED UP THE EP (Sessions)",
  afflictions: "Original Files/2. affliction (Sessions)",
  affliction: "Original Files/2. affliction (Sessions)",
  "hih 999": "Original Files/3. Heartbroken In Hollywood 9 9 9",
  "heartbroken in hollywood": "Original Files/3. Heartbroken In Hollywood 9 9 9",
  "jw 999": "Original Files/4. JuiceWRLD 9 9 9 (Sessions)",
  "juice wrld 999": "Original Files/4. JuiceWRLD 9 9 9 (Sessions)",
  bdm: "Original Files/5. BINGEDRINKINGMUSIC (Sessions)",
  "bingedrinkingmusic": "Original Files/5. BINGEDRINKINGMUSIC (Sessions)",
  nd: "Original Files/6. NOTHING'S DIFFERENT 3 (Sessions)",
  "nothing's different": "Original Files/6. NOTHING'S DIFFERENT 3 (Sessions)",
  "gb&gr": "Original Files/7. Goodbye & Good Riddance (Sessions)",
  "goodbye & good riddance": "Original Files/7. Goodbye & Good Riddance (Sessions)",
  wod: "Original Files/8. WRLD ON DRUGS (Sessions)",
  "world on drugs": "Original Files/8. WRLD ON DRUGS (Sessions)",
  "wrld on drugs": "Original Files/8. WRLD ON DRUGS (Sessions)",
  drfl: "Original Files/9. Death Race For Love (Sessions)",
  "death race for love": "Original Files/9. Death Race For Love (Sessions)",
  out: "Original Files/10. Outsiders (Sessions)",
  outsiders: "Original Files/10. Outsiders (Sessions)",
  post: "Original Files/11. Posthumous"
};
const SPEK_PATHS = [
  "C:\\Program Files\\Spek\\spek.exe",
  "C:\\Program Files (x86)\\Spek\\spek.exe",
  path.join(process.env.LOCALAPPDATA || "", "Programs", "Spek", "spek.exe")
];

let mainWindow;
let qualityScanToken = 0;
const artworkCache = new Map();
const imagePreviewCache = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1040,
    minHeight: 700,
    title: "Juice WRLD metadata",
    backgroundColor: "#f5f3ef",
    icon: path.join(__dirname, "assets", "icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    const runtimeDirectory = app.getPath("userData");
    const entry = `${new Date().toISOString()} render-process-gone ${JSON.stringify(details)}\n`;
    fs.appendFile(path.join(runtimeDirectory, "runtime.log"), entry, () => {});
    if (!mainWindow?.isDestroyed() && details.reason !== "clean-exit") {
      setTimeout(() => {
        if (!mainWindow?.isDestroyed()) mainWindow.reload();
      }, 250);
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  if (process.env.JUICE_WRLD_SCREENSHOT) {
    mainWindow.webContents.once("did-finish-load", async () => {
      try {
        const requestedView = String(process.env.JUICE_WRLD_SCREENSHOT_VIEW || "");
        if (["editor", "quality", "catalog", "covers", "tracker"].includes(requestedView)) {
          await mainWindow.webContents.executeJavaScript(
            `document.querySelector('[data-view="${requestedView}"]')?.click()`
          );
        }
        const screenshotQuery = String(process.env.JUICE_WRLD_SCREENSHOT_QUERY || "");
        if (screenshotQuery && ["catalog", "covers", "tracker"].includes(requestedView)) {
          await mainWindow.webContents.executeJavaScript(
            `(() => { const input = document.querySelector('#${requestedView === "catalog" ? "catalog" : requestedView}-search'); input.value = ${JSON.stringify(screenshotQuery)}; document.querySelector('#${requestedView === "catalog" ? "catalog" : requestedView}-submit')?.click(); })()`
          );
        }
        const settleTime = requestedView === "covers" && screenshotQuery
          ? 7000
          : (["catalog", "covers", "tracker"].includes(requestedView) ? 2800 : 700);
        await new Promise((resolve) => setTimeout(resolve, settleTime));
        const image = await mainWindow.webContents.capturePage();
        await fsp.writeFile(process.env.JUICE_WRLD_SCREENSHOT, image.toPNG());
      } catch (error) {
        console.error(`Falha no teste visual: ${error.message}`);
      } finally {
        app.quit();
      }
    });
  }
}

if (!process.env.JUICE_WRLD_TEST) {
  app.disableHardwareAcceleration();

  let runtimeDirectory = path.join(app.getPath("appData"), "Juice WRLD metadata");
  try {
    fs.mkdirSync(runtimeDirectory, { recursive: true });
  } catch (error) {
    runtimeDirectory = path.join(app.getPath("temp"), "Juice WRLD metadata");
    fs.mkdirSync(runtimeDirectory, { recursive: true });
    console.warn(`AppData indisponível; usando armazenamento temporário: ${error.message}`);
  }

  const cacheDirectory = path.join(runtimeDirectory, "Cache");
  const crashDirectory = path.join(runtimeDirectory, "Crashpad");
  fs.mkdirSync(cacheDirectory, { recursive: true });
  fs.mkdirSync(crashDirectory, { recursive: true });
  app.setPath("userData", runtimeDirectory);
  app.setPath("crashDumps", crashDirectory);
  app.commandLine.appendSwitch("disk-cache-dir", cacheDirectory);

  try {
    crashReporter.start({
      productName: "Juice WRLD metadata",
      uploadToServer: false
    });
  } catch (error) {
    console.warn(`O relatório local de falhas foi desativado: ${error.message}`);
  }

  app.whenReady().then(() => {
    registerIpc();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("child-process-gone", (_event, details) => {
    const entry = `${new Date().toISOString()} child-process-gone ${JSON.stringify(details)}\n`;
    fs.appendFile(path.join(runtimeDirectory, "runtime.log"), entry, () => {});
  });
}

function runProcess(command, args, { maxBuffer = 32 * 1024 * 1024, lowPriority = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    if (lowPriority && child.pid) {
      try {
        os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      } catch {
        // A análise continua normalmente se o sistema não permitir mudar a prioridade.
      }
    }
    const stdout = [];
    const stderr = [];
    let stdoutSize = 0;

    child.stdout.on("data", (chunk) => {
      stdoutSize += chunk.length;
      if (stdoutSize > maxBuffer) {
        child.kill();
        reject(new Error(`${command} retornou dados demais.`));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => reject(new Error(`${command} não está disponível: ${error.message}`)));
    child.on("close", (code) => {
      const errorText = Buffer.concat(stderr).toString("utf8");
      if (code !== 0) {
        reject(new Error(errorText.trim().split(/\r?\n/).slice(-5).join("\n") || `${command} encerrou com código ${code}.`));
        return;
      }
      resolve({ stdout: Buffer.concat(stdout), stderr: errorText });
    });
  });
}

async function probeAudio(filePath) {
  const result = await runProcess("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:format_tags=title,artist,album,date,year,genre,album_artist,albumartist,lyrics:stream=codec_name",
    "-of",
    "json",
    filePath
  ], { maxBuffer: 2 * 1024 * 1024 });
  const data = JSON.parse(result.stdout.toString("utf8") || "{}");
  const rawTags = data.format?.tags || {};
  const tags = Object.fromEntries(Object.entries(rawTags).map(([key, value]) => [key.toLowerCase(), String(value)]));
  if (path.extname(filePath).toLowerCase() === ".mp3") {
    try {
      const id3Tags = NodeID3.read(filePath);
      const id3Lyrics = String(id3Tags.unsynchronisedLyrics?.text || "").trim();
      if (id3Lyrics) tags.lyrics = id3Lyrics;
    } catch {
      // O restante dos metadados continua disponível mesmo se o ID3 estiver danificado.
    }
  }
  return {
    duration: Number(data.format?.duration || 0),
    codec: data.streams?.find((stream) => stream.codec_name)?.codec_name || "",
    tags
  };
}

async function listLocalAudioFiles(rootPath) {
  const files = [];
  const pending = [rootPath];
  while (pending.length && files.length < 10000) {
    const current = pending.pop();
    let entries = [];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
}

function codecKind(codec = "") {
  const normalized = String(codec).toLowerCase();
  if (normalized === "alac" || normalized === "flac" || normalized.startsWith("pcm_")) return "lossless";
  if (["mp3", "aac", "vorbis", "opus", "wmav1", "wmav2"].includes(normalized)) return "lossy";
  return "unknown";
}

function codecMatchesExtension(extension, codec) {
  const rules = {
    ".mp3": ["mp3"],
    ".m4a": ["alac", "aac"],
    ".aac": ["aac"],
    ".flac": ["flac"],
    ".wav": ["pcm_", "adpcm_"],
    ".ogg": ["vorbis", "opus"],
    ".opus": ["opus"],
    ".wma": ["wma"]
  };
  return (rules[extension] || []).some((expected) => String(codec).toLowerCase().startsWith(expected));
}

async function quickMp3Probe(filePath) {
  const handle = await fsp.open(filePath, "r");
  try {
    const stats = await handle.stat();
    const id3Header = Buffer.alloc(10);
    const headerRead = await handle.read(id3Header, 0, id3Header.length, 0);
    let audioOffset = 0;
    if (headerRead.bytesRead === 10 && id3Header.subarray(0, 3).toString("ascii") === "ID3") {
      const tagSize = ((id3Header[6] & 0x7f) << 21) | ((id3Header[7] & 0x7f) << 14) |
        ((id3Header[8] & 0x7f) << 7) | (id3Header[9] & 0x7f);
      audioOffset = 10 + tagSize + ((id3Header[5] & 0x10) ? 10 : 0);
    }
    if (audioOffset >= stats.size) return null;

    const sample = Buffer.alloc(Math.min(64 * 1024, stats.size - audioOffset));
    const sampleRead = await handle.read(sample, 0, sample.length, audioOffset);
    const data = sample.subarray(0, sampleRead.bytesRead);
    const mpeg1Rates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const mpeg2Rates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const sampleRates = [44100, 48000, 32000];
    for (let index = 0; index <= data.length - 4; index += 1) {
      const first = data[index];
      const second = data[index + 1];
      if (first !== 0xff || (second & 0xe0) !== 0xe0) continue;
      const versionBits = (second >> 3) & 0x03;
      const layerBits = (second >> 1) & 0x03;
      const bitrateIndex = (data[index + 2] >> 4) & 0x0f;
      const sampleRateIndex = (data[index + 2] >> 2) & 0x03;
      if (versionBits === 1 || layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) continue;
      const bitRateKbps = (versionBits === 3 ? mpeg1Rates : mpeg2Rates)[bitrateIndex];
      const sampleRate = Math.round(sampleRates[sampleRateIndex] / (versionBits === 3 ? 1 : (versionBits === 2 ? 2 : 4)));
      if (!bitRateKbps || !sampleRate) continue;
      const channels = ((data[index + 3] >> 6) & 0x03) === 3 ? 1 : 2;
      const audioBytes = Math.max(0, stats.size - audioOffset);
      return {
        codec: "mp3",
        sampleRate,
        channels,
        bits: 0,
        bitRate: bitRateKbps * 1000,
        duration: audioBytes * 8 / (bitRateKbps * 1000),
        fastProbe: true
      };
    }
    return null;
  } finally {
    await handle.close();
  }
}

async function findTopLevelMp4Atom(handle, fileSize, wantedType) {
  const header = Buffer.alloc(16);
  let position = 0;
  while (position + 8 <= fileSize) {
    const read = await handle.read(header, 0, 16, position);
    if (read.bytesRead < 8) return null;
    let atomSize = header.readUInt32BE(0);
    const atomType = header.subarray(4, 8).toString("ascii");
    let headerSize = 8;
    if (atomSize === 1) {
      if (read.bytesRead < 16) return null;
      const extendedSize = header.readBigUInt64BE(8);
      if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      atomSize = Number(extendedSize);
      headerSize = 16;
    } else if (atomSize === 0) {
      atomSize = fileSize - position;
    }
    if (atomSize < headerSize || position + atomSize > fileSize) return null;
    if (atomType === wantedType) return { position, size: atomSize, headerSize };
    position += atomSize;
  }
  return null;
}

async function quickM4aProbe(filePath) {
  const handle = await fsp.open(filePath, "r");
  try {
    const stats = await handle.stat();
    const moov = await findTopLevelMp4Atom(handle, stats.size, "moov");
    if (!moov) return null;
    const moovLength = Math.min(moov.size - moov.headerSize, 16 * 1024 * 1024);
    const data = Buffer.alloc(moovLength);
    const read = await handle.read(data, 0, data.length, moov.position + moov.headerSize);
    const payload = data.subarray(0, read.bytesRead);

    const mvhdIndex = payload.indexOf(Buffer.from("mvhd"));
    let duration = 0;
    if (mvhdIndex >= 0 && mvhdIndex + 36 <= payload.length) {
      const version = payload[mvhdIndex + 4];
      const timeScaleOffset = mvhdIndex + (version === 1 ? 24 : 16);
      const durationOffset = mvhdIndex + (version === 1 ? 28 : 20);
      const timeScale = payload.readUInt32BE(timeScaleOffset);
      const durationUnits = version === 1
        ? Number(payload.readBigUInt64BE(durationOffset))
        : payload.readUInt32BE(durationOffset);
      if (timeScale > 0) duration = durationUnits / timeScale;
    }

    let codec = "";
    let sampleRate = 0;
    let channels = 0;
    let bits = 0;
    let searchFrom = 0;
    const stsdMarker = Buffer.from("stsd");
    while (searchFrom < payload.length) {
      const stsdIndex = payload.indexOf(stsdMarker, searchFrom);
      if (stsdIndex < 0 || stsdIndex + 48 > payload.length) break;
      const entryType = payload.subarray(stsdIndex + 16, stsdIndex + 20).toString("ascii");
      if (entryType === "alac" || entryType === "mp4a") {
        codec = entryType === "alac" ? "alac" : "aac";
        channels = payload.readUInt16BE(stsdIndex + 36);
        bits = payload.readUInt16BE(stsdIndex + 38);
        sampleRate = Math.round(payload.readUInt32BE(stsdIndex + 44) / 65536);
        break;
      }
      searchFrom = stsdIndex + 4;
    }
    if (!codec || !duration || !sampleRate) return null;
    return {
      codec,
      sampleRate,
      channels,
      bits,
      bitRate: Math.round(stats.size * 8 / duration),
      duration,
      fastProbe: true
    };
  } finally {
    await handle.close();
  }
}

async function qualityProbe(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".mp3") {
    const quickProbe = await quickMp3Probe(filePath);
    if (quickProbe) return quickProbe;
  }
  if (extension === ".m4a") {
    const quickProbe = await quickM4aProbe(filePath);
    if (quickProbe) return quickProbe;
  }
  const result = await runProcess("ffprobe", [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=codec_name,sample_rate,channels,bits_per_raw_sample,bits_per_sample,bit_rate,duration:format=duration,bit_rate",
    "-of", "json",
    filePath
  ], { maxBuffer: 512 * 1024, lowPriority: true });
  const data = JSON.parse(result.stdout.toString("utf8") || "{}");
  const stream = data.streams?.[0];
  if (!stream?.codec_name) throw new Error("Nenhuma faixa de áudio foi encontrada.");
  return {
    codec: String(stream.codec_name).toLowerCase(),
    sampleRate: Number(stream.sample_rate || 0),
    channels: Number(stream.channels || 0),
    bits: Number(stream.bits_per_raw_sample || stream.bits_per_sample || 0),
    bitRate: Number(stream.bit_rate || data.format?.bit_rate || 0),
    duration: Number(stream.duration || data.format?.duration || 0)
  };
}

async function spectralSnapshot(filePath, sampleRate, start, sampleLength) {
  const width = 160;
  const height = 80;
  const result = await runProcess("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-threads", "1", "-ss", start.toFixed(3), "-t", sampleLength.toFixed(3), "-i", filePath,
    "-filter_threads", "1",
    "-lavfi", `showspectrumpic=s=${width}x${height}:legend=disabled:color=intensity:scale=log:fscale=lin:drange=100`,
    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"
  ], { maxBuffer: width * height * 2, lowPriority: true });
  const pixels = result.stdout;
  if (pixels.length < width * height) return null;
  const rows = Array.from({ length: height }, (_, row) => {
    let total = 0;
    const offset = row * width;
    for (let column = 0; column < width; column += 1) total += pixels[offset + column];
    return total / width;
  });
  const smoothed = rows.map((_value, row) => {
    const from = Math.max(0, row - 1);
    const to = Math.min(height, row + 2);
    return rows.slice(from, to).reduce((sum, value) => sum + value, 0) / (to - from);
  });
  const nyquist = sampleRate / 2;
  const rowForFrequency = (frequency) => Math.round((1 - Math.min(frequency, nyquist) / nyquist) * (height - 1));
  // Ignora a borda natural de Nyquist, que existe mesmo em masters lossless legítimas.
  const firstRow = Math.max(5, rowForFrequency(Math.min(20000, nyquist - 1000)));
  const lastRow = Math.min(height - 7, rowForFrequency(12000));
  let strongest = null;
  for (let row = firstRow; row < lastRow; row += 1) {
    const above = smoothed.slice(Math.max(0, row - 5), row);
    const below = smoothed.slice(row + 2, row + 7);
    if (!above.length || !below.length) continue;
    const aboveLevel = above.reduce((sum, value) => sum + value, 0) / above.length;
    const belowLevel = below.reduce((sum, value) => sum + value, 0) / below.length;
    const edgeStrength = belowLevel - aboveLevel;
    if (!strongest || edgeStrength > strongest.edgeStrength) {
      strongest = {
        edgeStrength: Math.round(edgeStrength * 10) / 10,
        cutoffHz: Math.round(nyquist * (1 - row / (height - 1))),
        aboveLevel: Math.round(aboveLevel * 10) / 10,
        belowLevel: Math.round(belowLevel * 10) / 10
      };
    }
  }
  if (!strongest) return null;
  return strongest;
}

function matchingSpectralCluster(segments) {
  const candidates = segments.filter((segment) => {
    const highFrequencyRatio = segment.belowLevel > 0 ? segment.aboveLevel / segment.belowLevel : 1;
    return segment.edgeStrength >= 26 && segment.cutoffHz <= 19500 && highFrequencyRatio <= 0.42;
  });
  let best = [];
  for (const candidate of candidates) {
    const cluster = candidates.filter((other) => Math.abs(other.cutoffHz - candidate.cutoffHz) <= 1100);
    if (cluster.length > best.length) best = cluster;
  }
  return best;
}

async function spectralEvidence(filePath, duration, sampleRate) {
  if (!duration || duration < 4 || sampleRate < 36000) return null;
  const sampleLength = Math.min(4, duration);
  const starts = [];
  const segments = [];
  const addSegment = async (ratio) => {
    const start = Math.max(0, Math.min(Math.max(0, duration - sampleLength), duration * ratio - sampleLength / 2));
    if (starts.some((known) => Math.abs(known - start) < 1)) return;
    starts.push(start);
    const snapshot = await spectralSnapshot(filePath, sampleRate, start, sampleLength);
    if (snapshot) segments.push({ ...snapshot, start: Math.round(start * 10) / 10 });
  };

  await addSegment(0.5);
  let cluster = matchingSpectralCluster(segments);
  if (duration >= 24 && cluster.length > 0) {
    await addSegment(0.27);
    await addSegment(0.73);
    cluster = matchingSpectralCluster(segments);
  }
  if (!segments.length) return null;

  const reference = cluster.length
    ? cluster
    : [segments.reduce((strongest, segment) => segment.edgeStrength > strongest.edgeStrength ? segment : strongest)];
  const average = (key) => reference.reduce((sum, segment) => sum + segment[key], 0) / reference.length;
  return {
    edgeStrength: Math.round(average("edgeStrength") * 10) / 10,
    cutoffHz: Math.round(average("cutoffHz")),
    aboveLevel: Math.round(average("aboveLevel") * 10) / 10,
    belowLevel: Math.round(average("belowLevel") * 10) / 10,
    confirmations: cluster.length,
    analyzedSegments: segments.length,
    segments,
    method: "multi-segment-spectral-edge"
  };
}

function classifyQuality(filePath, probe, spectrum) {
  const extension = path.extname(filePath).toLowerCase();
  const kind = codecKind(probe.codec);
  if (!codecMatchesExtension(extension, probe.codec)) {
    return { status: "suspect", reason: `A extensão ${extension.slice(1).toUpperCase()} não corresponde ao codec ${probe.codec.toUpperCase()}.` };
  }
  if (kind === "unknown") return { status: "review", reason: `O codec ${probe.codec.toUpperCase()} exige avaliação manual.` };

  const edge = spectrum?.edgeStrength;
  if (kind === "lossless") {
    if (!spectrum) return { status: "review", reason: "Não foi possível obter evidência espectral suficiente." };
    const confirmations = spectrum.confirmations || 0;
    const analyzedSegments = spectrum.analyzedSegments || 1;
    const persistentAcrossAll = confirmations >= 2 && confirmations === analyzedSegments;
    const highFrequencyRatio = spectrum.belowLevel > 0 ? spectrum.aboveLevel / spectrum.belowLevel : 1;
    if (persistentAcrossAll && edge >= 34 && spectrum.cutoffHz <= 18000 && highFrequencyRatio <= 0.3) {
      return { status: "suspect", reason: `Corte forte e persistente próximo de ${(spectrum.cutoffHz / 1000).toFixed(1)} kHz em ${confirmations} trechos; possível origem com perdas.` };
    }
    if (confirmations >= 2 && edge >= 30 && spectrum.cutoffHz <= 19000 && highFrequencyRatio <= 0.34) {
      return { status: "review", reason: `Limite espectral semelhante em ${confirmations} de ${analyzedSegments} trechos, próximo de ${(spectrum.cutoffHz / 1000).toFixed(1)} kHz.` };
    }
    if (analyzedSegments === 1 && edge >= 36 && spectrum.cutoffHz <= 18000 && highFrequencyRatio <= 0.3) {
      return { status: "review", reason: `Arquivo curto com corte forte próximo de ${(spectrum.cutoffHz / 1000).toFixed(1)} kHz; confirmação manual recomendada.` };
    }
    const cleanReason = analyzedSegments === 1
      ? "Codec lossless; o trecho de triagem não apresentou um corte candidato."
      : `Codec lossless; nenhum corte suspeito persistiu nos ${analyzedSegments} trechos analisados.`;
    return { status: "ok", reason: cleanReason };
  }

  const declaredKbps = Number(probe.bitRate || 0) / 1000;
  const confirmations = Number(spectrum?.confirmations || 0);
  const analyzedSegments = Number(spectrum?.analyzedSegments || 0);
  const highFrequencyRatio = spectrum?.belowLevel > 0 ? spectrum.aboveLevel / spectrum.belowLevel : 1;
  const highBitrateMp3 = extension === ".mp3" && declaredKbps >= 250;
  if (
    highBitrateMp3 &&
    confirmations >= 3 &&
    spectrum.edgeStrength >= 36 &&
    spectrum.cutoffHz <= 16800 &&
    highFrequencyRatio <= 0.3
  ) {
    return {
      status: "suspect",
      reason: `MP3 declara ${Math.round(declaredKbps)} kbps, mas apresenta corte forte e repetido perto de ${(spectrum.cutoffHz / 1000).toFixed(1)} kHz; possível recodificação de uma fonte de bitrate inferior.`
    };
  }
  if (highBitrateMp3 && analyzedSegments === 1 && spectrum?.edgeStrength >= 38 && spectrum.cutoffHz <= 16500) {
    return {
      status: "review",
      reason: `MP3 de ${Math.round(declaredKbps)} kbps com corte candidato perto de ${(spectrum.cutoffHz / 1000).toFixed(1)} kHz; confirme com o original ou no Spek.`
    };
  }
  return {
    status: "lossy",
    reason: highBitrateMp3
      ? "MP3 de bitrate alto sem evidência espectral forte de upsample na triagem."
      : "Formato com perdas; o bitrate informado é compatível, mas não prova origem autêntica por si só."
  };
}

async function analyzeQualityFile(filePath, rootPath) {
  try {
    const [probe, stats] = await Promise.all([qualityProbe(filePath), fsp.stat(filePath)]);
    const kind = codecKind(probe.codec);
    const shouldInspectSpectrum = kind === "lossless" ||
      (path.extname(filePath).toLowerCase() === ".mp3" && Number(probe.bitRate || 0) >= 250000);
    const spectrum = shouldInspectSpectrum ? await spectralEvidence(filePath, probe.duration, probe.sampleRate) : null;
    const classification = classifyQuality(filePath, probe, spectrum);
    return {
      path: filePath,
      relativePath: path.relative(rootPath, filePath),
      name: path.basename(filePath),
      extension: path.extname(filePath).slice(1).toUpperCase(),
      size: stats.size,
      ...probe,
      ...classification,
      spectrum
    };
  } catch (error) {
    return {
      path: filePath,
      relativePath: path.relative(rootPath, filePath),
      name: path.basename(filePath),
      extension: path.extname(filePath).slice(1).toUpperCase(),
      status: "error",
      reason: error.message
    };
  }
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(hash.digest("hex")));
  });
}

async function decodedAudioHash(filePath) {
  const result = await runProcess("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-threads", "1",
    "-i", filePath, "-map", "0:a:0", "-vn", "-c:a", "pcm_s32le",
    "-f", "hash", "-hash", "sha256", "pipe:1"
  ], { maxBuffer: 64 * 1024, lowPriority: true });
  const match = result.stdout.toString("utf8").match(/SHA256=([a-f0-9]{64})/i);
  if (!match) throw new Error("Não foi possível calcular a assinatura do áudio.");
  return match[1].toLowerCase();
}

async function encodedAudioHash(filePath) {
  const result = await runProcess("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-threads", "1",
    "-i", filePath, "-map", "0:a:0", "-vn", "-c:a", "copy",
    "-f", "hash", "-hash", "sha256", "pipe:1"
  ], { maxBuffer: 64 * 1024, lowPriority: true });
  const match = result.stdout.toString("utf8").match(/SHA256=([a-f0-9]{64})/i);
  if (!match) throw new Error("Não foi possível calcular a assinatura do fluxo de áudio.");
  return match[1].toLowerCase();
}

async function scanMusicQuality(rootPath, token) {
  const files = await listLocalAudioFiles(rootPath);
  mainWindow?.webContents.send("quality:progress", { phase: "found", total: files.length, rootPath });
  const results = new Array(files.length);
  let completed = 0;
  let batch = [];
  let lastBatchAt = Date.now();
  const flushBatch = () => {
    if (!batch.length) return;
    mainWindow?.webContents.send("quality:progress", {
      phase: "items",
      completed,
      total: files.length,
      items: batch
    });
    batch = [];
    lastBatchAt = Date.now();
  };
  for (let index = 0; index < files.length && token === qualityScanToken; index += 1) {
    const item = await analyzeQualityFile(files[index], rootPath);
    results[index] = item;
    completed += 1;
    batch.push({ index, item });
    if (batch.length >= 8 || Date.now() - lastBatchAt >= 250 || completed === files.length) flushBatch();
  }
  flushBatch();
  return { rootPath, total: files.length, cancelled: token !== qualityScanToken, results: results.filter(Boolean) };
}

function isInsideDirectory(filePath, directory) {
  const relative = path.relative(path.resolve(directory), path.resolve(filePath));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function firstYear(value = "") {
  const match = String(value).match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

function cleanStem(value, fallback = "music") {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return cleaned || fallback;
}

function uniqueOutput(target, source) {
  if (path.resolve(target).toLowerCase() === path.resolve(source).toLowerCase() || !fs.existsSync(target)) return target;
  const parsed = path.parse(target);
  for (let index = 1; ; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}

function uniqueDownloadPath(target) {
  if (!fs.existsSync(target)) return target;
  const parsed = path.parse(target);
  for (let index = 1; ; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}

async function downloadApiFile(remotePath, targetPath) {
  const response = await fetch(`${FILE_ENDPOINT}?path=${encodeURIComponent(remotePath)}`, {
    headers: { "User-Agent": "Juice-WRLD-metadata/1.0" }
  });
  if (!response.ok || !response.body) throw new Error(`Download indisponível (${response.status}).`);
  const temporaryPath = `${targetPath}.part-${process.pid}`;
  const file = fs.createWriteStream(temporaryPath);
  try {
    await new Promise(async (resolve, reject) => {
      file.once("error", reject);
      try {
        for await (const chunk of response.body) {
          if (!file.write(Buffer.from(chunk))) {
            await new Promise((ready) => file.once("drain", ready));
          }
        }
        file.end(resolve);
      } catch (error) {
        file.destroy();
        reject(error);
      }
    });
    await fsp.unlink(targetPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await fsp.rename(temporaryPath, targetPath);
  } catch (error) {
    file.destroy();
    await fsp.unlink(temporaryPath).catch(() => {});
    throw error;
  }
  return targetPath;
}

async function findCaseInsensitive(directory, stem) {
  try {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    const normalized = stem.toLowerCase();
    const match = entries.find(
      (entry) =>
        entry.isFile() &&
        path.parse(entry.name).name.toLowerCase() === normalized &&
        IMAGE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
    );
    return match ? path.join(directory, match.name) : "";
  } catch {
    return "";
  }
}

async function findAutomaticCover(filePath, title) {
  const folder = path.dirname(filePath);
  const coverFolder = path.join(folder, "covers");
  const stems = [...new Set([cleanStem(title, ""), path.parse(filePath).name, path.basename(folder)].filter(Boolean))];
  for (const directory of [coverFolder, folder]) {
    for (const stem of stems) {
      const found = await findCaseInsensitive(directory, stem);
      if (found) return found;
    }
  }
  return "";
}

async function imageDataUrl(imagePath) {
  if (!imagePath) return "";
  try {
    const stat = await fsp.stat(imagePath);
    const cacheKey = `${imagePath}:${stat.mtimeMs}:${stat.size}`;
    if (imagePreviewCache.has(cacheKey)) return imagePreviewCache.get(cacheKey);
    const source = nativeImage.createFromPath(imagePath);
    if (source.isEmpty()) return "";
    const size = source.getSize();
    const maxSide = 420;
    const scale = Math.min(1, maxSide / Math.max(size.width, size.height));
    const preview = scale < 1
      ? source.resize({
          width: Math.max(1, Math.round(size.width * scale)),
          height: Math.max(1, Math.round(size.height * scale)),
          quality: "good"
        })
      : source;
    const dataUrl = `data:image/jpeg;base64,${preview.toJPEG(80).toString("base64")}`;
    imagePreviewCache.set(cacheKey, dataUrl);
    while (imagePreviewCache.size > 48) imagePreviewCache.delete(imagePreviewCache.keys().next().value);
    return dataUrl;
  } catch {
    return "";
  }
}

async function embeddedArtwork(filePath) {
  const stat = await fsp.stat(filePath);
  const cacheKey = `${filePath}:${stat.mtimeMs}:${stat.size}`;
  if (artworkCache.has(cacheKey)) return artworkCache.get(cacheKey);
  try {
    const result = await runProcess(
      "ffmpeg",
      ["-v", "error", "-i", filePath, "-map", "0:v:0", "-frames:v", "1", "-vf", "scale=360:360:force_original_aspect_ratio=decrease", "-f", "image2pipe", "-vcodec", "png", "-"],
      { maxBuffer: 12 * 1024 * 1024 }
    );
    const dataUrl = `data:image/png;base64,${result.stdout.toString("base64")}`;
    artworkCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    artworkCache.set(cacheKey, "");
    return "";
  }
}

async function trackFromPath(filePath, withEmbeddedArtwork = false) {
  const info = await probeAudio(filePath);
  const folderName = path.basename(path.dirname(filePath));
  const title = info.tags.title || path.parse(filePath).name;
  const coverPath = await findAutomaticCover(filePath, title);
  let coverDataUrl = await imageDataUrl(coverPath);
  if (!coverDataUrl && withEmbeddedArtwork) coverDataUrl = await embeddedArtwork(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const artist = info.tags.artist || "Juice WRLD";
  const lyrics = info.tags.lyrics || "";

  return {
    id: crypto.randomUUID(),
    path: filePath,
    fileName: path.basename(filePath),
    type: extension.slice(1).toUpperCase(),
    title,
    artist,
    contributors: "",
    album: info.tags.album || folderName,
    year: firstYear(info.tags.date || info.tags.year || ""),
    genre: info.tags.genre || "Hip-Hop/Rap",
    albumArtist: info.tags.album_artist || info.tags.albumartist || "Juice WRLD",
    duration: info.duration,
    lyrics,
    lyricsStatus: lyrics ? "ready" : "idle",
    coverPath,
    coverDataUrl,
    coverSource: "auto",
    outputMode: extension === ".wav" ? "alac" : "keep"
  };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function metadataArgs(track, includeLyrics = true) {
  const contributors = String(track.contributors || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const artist = [track.artist || "Juice WRLD", ...contributors].filter(Boolean).join(", ");
  const metadata = {
    title: track.title,
    artist,
    album_artist: track.albumArtist || "Juice WRLD",
    album: track.album,
    date: track.year,
    genre: track.genre || "Hip-Hop/Rap",
    ...(includeLyrics ? { lyrics: track.lyrics } : {})
  };
  return Object.entries(metadata)
    .filter(([, value]) => String(value || "").trim())
    .flatMap(([key, value]) => ["-metadata", `${key}=${String(value).trim()}`]);
}

async function processTrack(track) {
  const source = track.path;
  const sourceExtension = path.extname(source).toLowerCase();
  const outputExtension = track.outputMode === "alac" ? ".m4a" : sourceExtension;
  const outputName = `${cleanStem(track.title, path.parse(source).name)}${outputExtension}`;
  const desiredOutput = path.join(path.dirname(source), outputName);
  const output = uniqueOutput(desiredOutput, source);
  const temp = path.join(path.dirname(source), `.${path.parse(output).name}.${crypto.randomUUID()}.tmp${outputExtension}`);
  const args = ["-y", "-i", source];
  const supportsCover = [".mp3", ".m4a", ".flac"].includes(outputExtension);
  const hasExternalCover = supportsCover && Boolean(track.coverPath && fs.existsSync(track.coverPath));

  if (hasExternalCover) args.push("-i", track.coverPath);

  args.push("-map", "0:a:0");
  if (hasExternalCover) {
    args.push("-map", "1:v:0");
  } else if (supportsCover) {
    args.push("-map", "0:v?");
  }

  if (track.outputMode === "alac") {
    args.push("-c:a", "alac");
    if (hasExternalCover) args.push("-c:v", "mjpeg");
    else if (supportsCover) args.push("-c:v", "copy");
    if (hasExternalCover || supportsCover) args.push("-disposition:v:0", "attached_pic");
    args.push("-movflags", "+faststart");
  } else {
    args.push("-c:a", "copy");
    if (hasExternalCover) {
      args.push("-c:v", sourceExtension === ".m4a" ? "mjpeg" : "copy", "-disposition:v:0", "attached_pic");
    } else if (supportsCover) {
      args.push("-c:v", "copy");
    }
    if (sourceExtension === ".mp3") args.push("-id3v2_version", "3");
  }

  args.push("-map_metadata", "-1", ...metadataArgs(track, outputExtension !== ".mp3"), temp);

  try {
    await runProcess("ffmpeg", args);
    if (outputExtension === ".mp3" && String(track.lyrics || "").trim()) {
      const writeResult = NodeID3.update({
        unsynchronisedLyrics: {
          language: "eng",
          text: String(track.lyrics).trim()
        }
      }, temp);
      if (writeResult !== true) {
        const detail = writeResult instanceof Error ? writeResult.message : "resultado inválido";
        throw new Error(`Não foi possível gravar a letra ID3: ${detail}.`);
      }
      const writtenTags = NodeID3.read(temp);
      if (!String(writtenTags.unsynchronisedLyrics?.text || "").trim()) {
        throw new Error("O arquivo MP3 foi criado, mas o quadro de letra USLT não pôde ser confirmado.");
      }
    }
    const verified = await probeAudio(temp);
    const expectedTitle = String(track.title || "").trim();
    const expectedArtist = String(track.artist || "Juice WRLD").trim();
    if ((expectedTitle && verified.tags.title !== expectedTitle) || (expectedArtist && !String(verified.tags.artist || "").startsWith(expectedArtist))) {
      throw new Error("O arquivo foi criado, mas os metadados não puderam ser confirmados.");
    }
    if (path.resolve(output).toLowerCase() === path.resolve(source).toLowerCase()) {
      const backup = path.join(path.dirname(source), `.${path.basename(source)}.${crypto.randomUUID()}.backup`);
      await fsp.rename(source, backup);
      try {
        await fsp.rename(temp, output);
        await fsp.unlink(backup);
      } catch (error) {
        if (fs.existsSync(backup)) await fsp.rename(backup, source);
        throw error;
      }
    } else {
      await fsp.rename(temp, output);
      if (sourceExtension === outputExtension || (sourceExtension === ".wav" && track.outputMode === "alac")) {
        await fsp.unlink(source);
      }
    }
    return output;
  } catch (error) {
    await fsp.unlink(temp).catch(() => {});
    throw error;
  }
}

function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "Juice-WRLD-metadata/1.0" } });
  if (!response.ok) throw new Error(`Serviço indisponível (${response.status}).`);
  return response.json();
}

async function loadTracker() {
  const response = await fetch(TRACKER_CSV, { headers: { "User-Agent": "Juice-WRLD-metadata/1.0" } });
  if (!response.ok) throw new Error(`Tracker indisponível (${response.status}).`);
  const table = csvRows(await response.text());
  const headerIndex = table.findIndex((row) => row.some((cell) => cell.trim() === "ERA | Track Title(s):"));
  if (headerIndex < 0) throw new Error("Não foi possível reconhecer as colunas do tracker.");
  const rows = table.slice(headerIndex + 1).map((row) => ({
    era: row[0]?.trim() || "",
    number: row[1]?.trim() || "",
    title: row[2]?.trim() || "",
    artists: row[3]?.trim() || "",
    producers: row[4]?.trim() || "",
    information: row[6]?.trim() || "",
    fileNames: row[7]?.trim() || "",
    instrumentals: row[8]?.trim() || "",
    recordingLocations: row[9]?.trim() || "",
    recordDates: row[10]?.trim() || "",
    dates: row[12]?.trim() || "",
    duration: row[13]?.trim() || "",
    category: row[14]?.trim() || "",
    available: row[15]?.trim() || ""
  })).filter((row) => row.era && row.title && !/tracks$/i.test(row.era));
  return rows;
}

function normalizedWords(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\b(?:mix|master|mastered|main|final|version|session|stems?|trackouts?|instrumental|prod|wav|mp3|m4a|flac|v\d+|pm|mds|freeze|becker|lp|ns|nw)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1 && !/^\d+$/.test(word));
}

function matchScore(fileName, values) {
  const source = new Set(normalizedWords(fileName));
  const candidate = new Set(normalizedWords(values.join(" ")));
  if (!source.size || !candidate.size) return 0;
  let intersection = 0;
  for (const word of source) if (candidate.has(word)) intersection += 1;
  const coverage = intersection / Math.min(source.size, candidate.size);
  const sourceText = [...source].join(" ");
  const candidateText = [...candidate].join(" ");
  const containsBonus = sourceText.includes(candidateText) || candidateText.includes(sourceText) ? 0.35 : 0;
  return coverage + containsBonus;
}

function isExcludedCatalogVersion(...values) {
  return values.some((value) =>
    /\.[rl](?:\.[a-z0-9]{2,5})?$/i.test(String(value || "").trim())
  );
}

async function browseFiles(options = {}) {
  const requestedPath = String(options.path || "");
  const query = String(options.query || "").trim();
  const extension = String(options.extension || "all").toLowerCase();
  const page = Math.max(1, Number(options.page) || 1);
  const search = query || (extension !== "all" ? `.${extension.replace(/^\./, "")}` : "");
  const params = new URLSearchParams({
    path: requestedPath,
    page: String(page),
    page_size: String(Math.min(24, Math.max(1, Number(options.pageSize) || 18)))
  });
  if (search) params.set("search", search);
  const data = await fetchJson(`${FILE_BROWSE_ENDPOINT}?${params.toString()}`);
  let items = data.items || [];
  if (query && extension !== "all") {
    const wanted = `.${extension.replace(/^\./, "")}`;
    items = items.filter((item) => item.type === "directory" || String(item.extension || "").toLowerCase() === wanted);
  }
  return {
    currentPath: data.current_path || requestedPath,
    pathParts: data.path_parts || [],
    totalItems: data.total_items || 0,
    totalFiles: data.total_files || 0,
    totalDirectories: data.total_directories || 0,
    recursive: Boolean(data.is_recursive_search),
    page: data.page || page,
    pageCount: data.page_count || 1,
    hasMore: Boolean(data.has_more),
    items: items.map((item) => {
      return {
        name: item.name,
        path: item.path,
        type: item.type,
        itemCount: item.item_count || 0,
        size: item.size || 0,
        sizeHuman: item.size_human || "",
        extension: item.extension || "",
        mimeType: item.mime_type || "",
        duration: item.duration || "",
        modified: item.modified || "",
        audioUrl: item.type === "file" ? `${FILE_ENDPOINT}?path=${encodeURIComponent(item.path)}` : ""
      };
    })
  };
}

async function browseAudioSource(source, query, format, page) {
  const requestedFormat = ["wav", "mp3"].includes(format) ? format : "all";
  const browse = (extension, pageSize) =>
    browseFiles({
      path: source.path,
      query,
      extension,
      page,
      pageSize
    });
  const responses = requestedFormat === "all"
    ? await Promise.all([browse("wav", 6), browse("mp3", 6)])
    : [await browse(requestedFormat, 12)];
  const items = responses
    .flatMap((response) => response.items)
    .filter((item) => item.type === "file")
    .slice(0, 12);
  return {
    items,
    totalFiles: responses.reduce((total, response) => total + Number(response.totalFiles || 0), 0),
    hasMore: responses.some((response) => response.hasMore),
    pageCount: Math.max(1, ...responses.map((response) => Number(response.pageCount || 1)))
  };
}

async function searchOriginalFiles(query, page = 1, filters = {}) {
  const normalizedQuery = String(query || "").trim();
  const selectedPage = Math.max(1, Number(page) || 1);
  const format = ["wav", "mp3"].includes(filters.format) ? filters.format : "all";
  const era = String(filters.era || "").trim();
  if (normalizedQuery.length === 1) return { count: 0, next: false, previous: false, results: [] };
  const sourcePath = era ? ORIGINAL_ERA_PATHS[era.toLowerCase()] : "Original Files";
  if (!sourcePath) return { count: 0, next: false, previous: selectedPage > 1, results: [] };
  const files = await browseAudioSource(
    { path: sourcePath, label: "Original Files" },
    normalizedQuery,
    format,
    selectedPage
  );
  const results = (files.items || [])
    .filter((file) =>
      file.type === "file" &&
      (String(file.mimeType || "").startsWith("audio/") || AUDIO_EXTENSIONS.has(String(file.extension || "").toLowerCase()))
    )
    .filter((file) => !isExcludedCatalogVersion(file.name, file.path))
    .map((file) => {
      const pathParts = String(file.path || "").split("/").filter(Boolean);
      return {
        id: `original-${file.path}`,
        name: file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        artists: "Juice WRLD",
        category: (file.extension || "").replace(".", "").toUpperCase(),
        era: pathParts[1]?.replace(/^\d+\.\s*/, "").replace(/\s*\(Sessions\)\s*$/i, "") || "",
        path: file.path,
        duration: file.duration || "",
        size: file.size || 0,
        sizeHuman: file.sizeHuman || "",
        extension: file.extension || "",
        mimeType: file.mimeType || "",
        source: "Original Files",
        audioUrl: file.audioUrl
      };
    });
  return {
    count: Number(files.totalFiles || results.length),
    next: Boolean(files.hasMore),
    previous: selectedPage > 1,
    pageCount: Number(files.pageCount || 1),
    results
  };
}

async function compareWithOriginal(localPath, original) {
  if (!localPath || !fs.existsSync(localPath)) throw new Error("O arquivo local não está disponível.");
  const remotePath = String(original?.path || "");
  if (!remotePath.startsWith("Original Files/") || !AUDIO_EXTENSIONS.has(path.extname(remotePath).toLowerCase())) {
    throw new Error("Selecione um arquivo válido de Original Files.");
  }
  const temporaryDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), "juice-original-check-"));
  const temporaryFile = path.join(temporaryDirectory, `original${path.extname(remotePath).toLowerCase() || ".audio"}`);
  try {
    await downloadApiFile(remotePath, temporaryFile);
    const [localProbe, originalProbe, localFileHash, originalFileHash] = await Promise.all([
      qualityProbe(localPath),
      qualityProbe(temporaryFile),
      hashFile(localPath),
      hashFile(temporaryFile)
    ]);
    const exactFile = localFileHash === originalFileHash;
    let exactAudio = exactFile;
    let exactEncodedAudio = exactFile;
    if (!exactFile) {
      if (localProbe.codec === originalProbe.codec && ["mp3", "aac"].includes(localProbe.codec)) {
        const [localEncodedHash, originalEncodedHash] = await Promise.all([
          encodedAudioHash(localPath),
          encodedAudioHash(temporaryFile)
        ]);
        exactEncodedAudio = localEncodedHash === originalEncodedHash;
        exactAudio = exactEncodedAudio;
      }
      if (!exactAudio) {
        const [localAudioHash, originalAudioHash] = await Promise.all([
          decodedAudioHash(localPath),
          decodedAudioHash(temporaryFile)
        ]);
        exactAudio = localAudioHash === originalAudioHash;
      }
    }
    const [localAnalysis, originalAnalysis] = await Promise.all([
      analyzeQualityFile(localPath, path.dirname(localPath)),
      analyzeQualityFile(temporaryFile, temporaryDirectory)
    ]);
    const durationDifference = Math.abs(Number(localProbe.duration || 0) - Number(originalProbe.duration || 0));
    const localKbps = Math.round(Number(localProbe.bitRate || 0) / 1000);
    const originalKbps = Math.round(Number(originalProbe.bitRate || 0) / 1000);
    const sameTechnicalShape = durationDifference <= 0.2 &&
      Number(localProbe.sampleRate || 0) === Number(originalProbe.sampleRate || 0) &&
      Number(localProbe.channels || 0) === Number(originalProbe.channels || 0);
    let status = "review";
    let title = "Comparação inconclusiva";
    let reason = "Os parâmetros são próximos, mas a assinatura do áudio não coincide com este original.";
    if (exactFile) {
      status = "verified";
      title = "Arquivo original confirmado";
      reason = "O SHA-256 do arquivo local é idêntico ao arquivo da API.";
    } else if (exactEncodedAudio) {
      status = "verified";
      title = "Áudio original confirmado";
      reason = "O fluxo de áudio comprimido é idêntico; apenas metadados ou estrutura do contêiner diferem.";
    } else if (exactAudio) {
      status = "verified";
      title = "Áudio original confirmado";
      reason = "O conteúdo de áudio decodificado é idêntico; apenas contêiner ou metadados diferem.";
    } else if (!sameTechnicalShape || durationDifference > 1) {
      status = "suspect";
      title = "Não corresponde a este original";
      reason = `A estrutura técnica diverge do original selecionado (diferença de ${durationDifference.toFixed(2)} s).`;
    } else if (
      path.extname(localPath).toLowerCase() === ".mp3" &&
      localKbps >= 250 && originalKbps > 0 && originalKbps <= 192 && localKbps >= originalKbps + 64
    ) {
      status = "suspect";
      title = "Possível aumento artificial de bitrate";
      reason = `O arquivo local declara ${localKbps} kbps, enquanto este original usa ${originalKbps} kbps, e as assinaturas não coincidem.`;
    } else if (localAnalysis.status === "suspect") {
      status = "suspect";
      title = "Arquivo local exige atenção";
      reason = localAnalysis.reason;
    }
    return {
      status,
      title,
      reason,
      exactFile,
      exactAudio,
      exactEncodedAudio,
      durationDifference,
      local: {
        codec: localProbe.codec,
        sampleRate: localProbe.sampleRate,
        channels: localProbe.channels,
        bits: localProbe.bits,
        bitRate: localProbe.bitRate,
        duration: localProbe.duration,
        qualityStatus: localAnalysis.status,
        qualityReason: localAnalysis.reason,
        spectrum: localAnalysis.spectrum
      },
      original: {
        path: remotePath,
        codec: originalProbe.codec,
        sampleRate: originalProbe.sampleRate,
        channels: originalProbe.channels,
        bits: originalProbe.bits,
        bitRate: originalProbe.bitRate,
        duration: originalProbe.duration,
        qualityStatus: originalAnalysis.status,
        qualityReason: originalAnalysis.reason,
        spectrum: originalAnalysis.spectrum
      }
    };
  } finally {
    await fsp.unlink(temporaryFile).catch(() => {});
    await fsp.rmdir(temporaryDirectory).catch(() => {});
  }
}

async function searchCovers(query, page = 1) {
  const normalizedQuery = String(query || "").trim();
  if (normalizedQuery.length < 2) {
    return { page: 1, pageCount: 1, totalFiles: 0, hasMore: false, items: [] };
  }
  const inferCreator = (item) => String(item.path || "").split("/").filter(Boolean)[1] || "";
  const direct = await browseFiles({
    path: "Cover Arts",
    query: normalizedQuery,
    extension: "all",
    page,
    pageSize: 24
  });
  let items = direct.items
    .filter((item) => item.type === "file" && matchScore(item.name, [normalizedQuery]) >= 0.5)
    .map((item) => ({ ...item, creator: inferCreator(item) }));

  const creatorDirectories = direct.items.filter((item) =>
    item.type === "directory" && matchScore(item.name, [normalizedQuery]) >= 0.8
  );
  if (!items.length && creatorDirectories.length) {
    const creatorResults = await Promise.allSettled(
      creatorDirectories.slice(0, 6).map((directory) => browseFiles({
        path: directory.path,
        query: ".",
        extension: "all",
        page,
        pageSize: 18
      }))
    );
    items = creatorResults
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value.items)
      .filter((item) => item.type === "file")
      .map((item) => ({ ...item, creator: inferCreator(item) }));
    const available = creatorResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    return {
      page,
      pageCount: Math.max(1, ...available.map((result) => Number(result.pageCount || 1))),
      totalFiles: available.reduce((total, result) => total + Number(result.totalFiles || 0), 0),
      hasMore: available.some((result) => result.hasMore),
      items: items.slice(0, 18)
    };
  }
  return {
    page,
    pageCount: Number(direct.pageCount || 1),
    totalFiles: Number(direct.totalFiles || items.length),
    hasMore: Boolean(direct.hasMore),
    items: items.slice(0, 18)
  };
}

async function coverThumbnail(filePath) {
  const normalizedPath = String(filePath || "");
  if (!normalizedPath.startsWith("Cover Arts/")) throw new Error("Caminho de cover inválido.");
  const response = await fetch(`${FILE_ENDPOINT}?path=${encodeURIComponent(normalizedPath)}`, {
    headers: { "User-Agent": "Juice-WRLD-metadata/1.0" }
  });
  if (!response.ok) throw new Error(`Miniatura indisponível (${response.status}).`);
  const source = Buffer.from(await response.arrayBuffer());
  const thumbnail = await imageThumbnailWithFfmpeg(source);
  return `data:image/jpeg;base64,${thumbnail.toString("base64")}`;
}

async function coverPreview(filePath) {
  const normalizedPath = String(filePath || "");
  if (!normalizedPath.startsWith("Cover Arts/")) throw new Error("Caminho de cover inválido.");
  const response = await fetch(`${FILE_ENDPOINT}?path=${encodeURIComponent(normalizedPath)}`, {
    headers: { "User-Agent": "Juice-WRLD-metadata/1.0" }
  });
  if (!response.ok) throw new Error(`Imagem indisponível (${response.status}).`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 40 * 1024 * 1024) throw new Error("Esta imagem é grande demais para visualizar.");
  const source = Buffer.from(await response.arrayBuffer());
  if (source.length > 40 * 1024 * 1024) throw new Error("Esta imagem é grande demais para visualizar.");
  const image = nativeImage.createFromBuffer(source);
  if (image.isEmpty()) throw new Error("O formato desta imagem não pôde ser lido.");
  const { width, height } = image.getSize();
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const preview = scale < 1
    ? image.resize({
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        quality: "good"
      })
    : image;
  return {
    dataUrl: `data:image/jpeg;base64,${preview.toJPEG(80).toString("base64")}`,
    width,
    height,
    previewWidth: preview.getSize().width,
    previewHeight: preview.getSize().height,
    bytes: source.length,
    mimeType: response.headers.get("content-type") || ""
  };
}

async function applyRemoteCoverToTrack({ filePath, title, currentCoverPath, cover }) {
  if (!filePath || !fs.existsSync(filePath)) throw new Error("A música selecionada não está disponível.");
  const remotePath = String(cover?.path || "");
  if (!remotePath.startsWith("Cover Arts/") || !IMAGE_EXTENSIONS.includes(path.extname(remotePath).toLowerCase())) {
    throw new Error("Selecione uma capa válida da API.");
  }
  const musicFolder = path.dirname(filePath);
  const coversFolder = path.join(musicFolder, "covers");
  await fsp.mkdir(coversFolder, { recursive: true });
  const extension = path.extname(remotePath).toLowerCase();
  const targetPath = path.join(coversFolder, `${cleanStem(title || path.parse(filePath).name, "cover")}${extension}`);
  await downloadApiFile(remotePath, targetPath);

  const previousPath = String(currentCoverPath || "");
  if (
    previousPath &&
    path.resolve(previousPath).toLowerCase() !== path.resolve(targetPath).toLowerCase() &&
    isInsideDirectory(previousPath, coversFolder) &&
    IMAGE_EXTENSIONS.includes(path.extname(previousPath).toLowerCase())
  ) {
    await fsp.unlink(previousPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  return { path: targetPath, dataUrl: await imageDataUrl(targetPath) };
}

function imageThumbnailWithFfmpeg(source) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-vf", "scale=480:480:force_original_aspect_ratio=decrease",
      "-frames:v", "1",
      "-f", "image2pipe",
      "-c:v", "mjpeg",
      "-q:v", "4",
      "pipe:1"
    ], { windowsHide: true });
    const output = [];
    const errors = [];
    let outputSize = 0;
    let settled = false;

    const fail = (message) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    child.stdout.on("data", (chunk) => {
      outputSize += chunk.length;
      if (outputSize > 8 * 1024 * 1024) {
        child.kill();
        fail("A miniatura gerada é grande demais.");
        return;
      }
      output.push(chunk);
    });
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.on("error", (error) => fail(`FFmpeg indisponível: ${error.message}`));
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0 || !output.length) {
        fail(Buffer.concat(errors).toString("utf8").trim() || "Não foi possível gerar a miniatura.");
        return;
      }
      settled = true;
      resolve(Buffer.concat(output));
    });
    child.stdin.on("error", (error) => fail(`Não foi possível ler a imagem: ${error.message}`));
    child.stdin.end(source);
  });
}

async function searchTrackerDetails(query) {
  const normalized = String(query || "").trim();
  if (!normalized) return [];
  const trackerRows = await loadTracker();
  const trackerMatches = trackerRows
    .filter((row) => [row.title, row.artists, row.producers, row.era, row.fileNames, row.instrumentals].join(" ").toLowerCase().includes(normalized.toLowerCase()))
    .slice(0, 30);

  let apiSongs = [];
  try {
    const data = await fetchJson(`${SONGS_ENDPOINT}?search=${encodeURIComponent(normalized)}`);
    apiSongs = data.results || [];
  } catch {
    apiSongs = [];
  }

  const usedTracker = new Set();
  const results = apiSongs.slice(0, 25).map((song) => {
    const ranked = trackerMatches
      .map((row, index) => ({
        row,
        index,
        score: matchScore(song.name, [row.title, row.fileNames])
      }))
      .sort((left, right) => right.score - left.score);
    const trackerMatch = ranked[0]?.score >= 0.48 ? ranked[0] : null;
    if (trackerMatch) usedTracker.add(trackerMatch.index);
    const row = trackerMatch?.row;
    const creditedArtists = song.credited_artists || row?.artists || "Juice WRLD";
    return {
      id: `api-${song.id}`,
      title: song.original_key || song.name,
      aliases: song.track_titles || [],
      artists: creditedArtists,
      composers: song.composers || song.songwriters || song.writers || creditedArtists,
      participations: participationCredits(
        creditedArtists,
        song.featured_artists || song.features || song.featuring
      ),
      era: song.era?.name || row?.era || "",
      category: song.category || row?.category || "",
      producers: song.producers || row?.producers || "",
      engineers: song.engineers || "",
      instrumentals: song.instrumentals || song.instrumental_names || row?.instrumentals || "",
      recordDates: song.record_dates || row?.recordDates || "",
      previewDate: song.preview_date || "",
      releaseDate: song.release_date || song.date_leaked || row?.dates || "",
      length: song.length || row?.duration || "",
      availableFiles: row?.available || song.bitrate || "",
      fileNames: song.file_names || row?.fileNames || "",
      recordingLocations: song.recording_locations || row?.recordingLocations || "",
      information: song.additional_information || row?.information || "",
      imageUrl: song.image_url ? new URL(song.image_url, API_BASE).toString() : "",
      path: song.path || ""
    };
  });

  trackerMatches.forEach((row, index) => {
    if (usedTracker.has(index)) return;
    results.push({
      id: `tracker-${index}-${row.era}-${row.number}`,
      title: row.title,
      aliases: [],
      artists: row.artists,
      composers: row.artists,
      participations: participationCredits(row.artists),
      era: row.era,
      category: row.category,
      producers: row.producers,
      engineers: "",
      instrumentals: row.instrumentals,
      recordDates: row.recordDates,
      previewDate: "",
      releaseDate: row.dates,
      length: row.duration,
      availableFiles: row.available,
      fileNames: row.fileNames,
      recordingLocations: row.recordingLocations,
      information: row.information,
      imageUrl: "",
      path: ""
    });
  });
  return results.slice(0, 10);
}

function durationSeconds(value) {
  if (Number.isFinite(Number(value)) && Number(value) > 0) return Number(value);
  const match = String(value || "").trim().match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
  if (match) return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  const shortMatch = String(value || "").trim().match(/^(\d+):(\d+(?:\.\d+)?)$/);
  return shortMatch ? Number(shortMatch[1]) * 60 + Number(shortMatch[2]) : 0;
}

function comparableSongName(value) {
  return normalizedWords(String(value || "").replace(/^juice\s+wrld\s*[-–—]\s*/i, "")).join(" ");
}

function exactSongName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^juice\s+wrld\s*[-–—]\s*/i, "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function songNames(song) {
  const listValues = (value) => Array.isArray(value)
    ? value
    : String(value || "").split(/[\r\n|]+/).map((item) => item.trim()).filter(Boolean);
  return [
    song.name,
    song.original_key,
    ...listValues(song.track_titles),
    ...listValues(song.file_names),
    ...listValues(song.session_titles),
    song.path ? path.parse(song.path).name : ""
  ].filter(Boolean);
}

function lyricsCandidateSummary(song, score, durationDifference) {
  return {
    id: song.id,
    title: song.original_key || song.name,
    aliases: song.track_titles || [],
    artists: song.credited_artists || "Juice WRLD",
    era: song.era?.name || "",
    length: song.length || "",
    hasLyrics: Boolean(String(song.lyrics || "").trim()),
    score: Math.round(score * 100) / 100,
    durationDifference: Number.isFinite(durationDifference) ? Math.round(durationDifference * 10) / 10 : null
  };
}

async function findLyricsMatch(track = {}) {
  const title = String(track.title || "").trim();
  const fileStem = path.parse(String(track.fileName || track.path || "")).name;
  const queryNames = [...new Set([title, fileStem].map((value) => value.replace(/^juice\s+wrld\s*[-–—]\s*/i, "").trim()).filter((value) => value.length >= 2))];
  if (!queryNames.length) return { status: "not_found", message: "Informe um título para buscar a letra.", candidates: [] };

  const candidatesById = new Map();
  for (const query of queryNames) {
    try {
      const data = await fetchJson(`${SONGS_ENDPOINT}?search=${encodeURIComponent(query)}&page=1&page_size=30`);
      for (const song of data.results || []) candidatesById.set(String(song.id), song);
    } catch {
      // A segunda forma do nome ainda pode encontrar a música quando uma consulta falha.
    }
  }
  const songs = [...candidatesById.values()].filter((song) => String(song.lyrics || "").trim());
  if (!songs.length) return { status: "not_found", message: "A API não encontrou letras para este nome.", candidates: [] };

  const titleKey = exactSongName(title);
  const fileKey = exactSongName(fileStem);
  const localDuration = durationSeconds(track.duration);
  const ranked = songs.map((song) => {
    const names = songNames(song);
    const nameKeys = names.map(exactSongName).filter(Boolean);
    const primaryKeys = [song.name, song.original_key].map(exactSongName).filter(Boolean);
    const titlePrimaryExact = Boolean(titleKey && primaryKeys.includes(titleKey));
    const titleExact = Boolean(titleKey && nameKeys.includes(titleKey));
    const fileExact = Boolean(fileKey && nameKeys.includes(fileKey));
    const candidateDuration = durationSeconds(song.length);
    const durationDifference = localDuration && candidateDuration
      ? Math.abs(localDuration - candidateDuration)
      : Number.POSITIVE_INFINITY;
    let score = Math.max(matchScore(title || fileStem, names), matchScore(fileStem, names));
    if (titlePrimaryExact) score += 6;
    else if (titleExact) score += 4;
    if (fileExact) score += 2;
    if (durationDifference <= 2.5) score += 3;
    else if (durationDifference <= 5) score += 1;
    return { song, score, titlePrimaryExact, titleExact, fileExact, durationDifference, durationKnown: Boolean(localDuration && candidateDuration) };
  }).sort((left, right) => right.score - left.score);

  const primaryExactCandidates = ranked.filter((item) => item.titlePrimaryExact);
  const exactCandidates = primaryExactCandidates.length
    ? primaryExactCandidates
    : ranked.filter((item) => item.titleExact || item.fileExact);
  const safeCandidates = exactCandidates.filter((item) =>
    (item.durationKnown && item.durationDifference <= 3) ||
    (!item.durationKnown && exactCandidates.length === 1)
  );
  const best = safeCandidates[0];
  const second = safeCandidates[1];
  if (!best || (second && best.score - second.score < 1)) {
    return {
      status: "ambiguous",
      message: exactCandidates.length
        ? "Há mais de uma versão possível. A letra não foi aplicada."
        : "Nenhuma correspondência exata por título ou alias foi confirmada.",
      candidates: ranked.slice(0, 5).map((item) => lyricsCandidateSummary(item.song, item.score, item.durationDifference))
    };
  }

  const song = best.song;
  const durationReason = best.durationKnown
    ? `Título ou alias exato e duração compatível (diferença de ${best.durationDifference.toFixed(1)} s).`
    : "Título ou alias exato e único na consulta.";
  return {
    status: "matched",
    message: durationReason,
    match: {
      ...lyricsCandidateSummary(song, best.score, best.durationDifference),
      lyrics: String(song.lyrics || "").trim(),
      reason: durationReason
    },
    candidates: []
  };
}

async function getLyricsCandidate(id) {
  const songId = String(id || "").trim();
  if (!/^\d+$/.test(songId)) throw new Error("Candidato de letra inválido.");
  const song = await fetchJson(`${SONGS_ENDPOINT}${songId}/`);
  const lyrics = String(song.lyrics || "").trim();
  if (!lyrics) throw new Error("Este registro não possui letra disponível.");
  return {
    ...lyricsCandidateSummary(song, 0, Number.POSITIVE_INFINITY),
    lyrics
  };
}

function participationCredits(creditedArtists, explicit = "") {
  const explicitText = Array.isArray(explicit) ? explicit.join(", ") : String(explicit || "").trim();
  if (explicitText) return explicitText;
  const names = String(creditedArtists || "")
    .replace(/\bjuice\s+wrld\b/gi, "")
    .replace(/\b(?:feat(?:uring)?|ft)\.?\b/gi, ",")
    .split(/[,&;/]+/)
    .map((name) => name.replace(/[()[\]]/g, "").trim())
    .filter(Boolean);
  return [...new Set(names)].join(", ") || "Sem participações creditadas";
}

function registerIpc() {
  ipcMain.handle("music:add", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Adicionar músicas",
      defaultPath: app.getPath("music"),
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Áudio", extensions: [...AUDIO_EXTENSIONS].map((extension) => extension.slice(1)) }]
    });
    if (result.canceled) return [];
    const imported = await mapLimit(result.filePaths, 2, async (filePath) => {
      try {
        return { track: await trackFromPath(filePath), filePath, error: "" };
      } catch (error) {
        return { track: null, filePath, error: error.message };
      }
    });
    return {
      tracks: imported.flatMap((item) => item.track ? [item.track] : []),
      errors: imported.flatMap((item) => item.error ? [{ filePath: item.filePath, error: item.error }] : [])
    };
  });

  ipcMain.handle("cover:choose", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Escolher capa",
      properties: ["openFile"],
      filters: [{ name: "Imagens", extensions: IMAGE_EXTENSIONS.map((extension) => extension.slice(1)) }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return { path: result.filePaths[0], dataUrl: await imageDataUrl(result.filePaths[0]) };
  });

  ipcMain.handle("tracks:process", async (_event, tracks) => {
    const results = [];
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      mainWindow.webContents.send("tracks:progress", { index, total: tracks.length, title: track.title });
      try {
        const outputPath = await processTrack(track);
        results.push({ id: track.id, ok: true, outputPath });
      } catch (error) {
        results.push({ id: track.id, ok: false, error: error.message });
      }
    }
    mainWindow.webContents.send("tracks:progress", { done: true, total: tracks.length });
    return results;
  });

  ipcMain.handle("catalog:filter-options", async () => {
    const erasRequest = await Promise.resolve(fetchJson(`${ERAS_ENDPOINT}?page=1&page_size=200`))
      .then((value) => ({ status: "fulfilled", value }))
      .catch((reason) => ({ status: "rejected", reason }));
    return {
      categories: [],
      eras: erasRequest.status === "fulfilled"
        ? (Array.isArray(erasRequest.value) ? erasRequest.value : (erasRequest.value.results || []))
            .filter((era) => Boolean(ORIGINAL_ERA_PATHS[String(era?.name || era || "").toLowerCase()]))
        : []
    };
  });

  ipcMain.handle("catalog:search", async (_event, { query, page, filters = {} }) => {
    return searchOriginalFiles(query, page, filters);
  });

  ipcMain.handle("editor:covers-search", async (_event, { query, page }) => {
    return searchCovers(query, Number(page) || 1);
  });

  ipcMain.handle("editor:cover-apply", async (_event, payload) => {
    return applyRemoteCoverToTrack(payload || {});
  });

  ipcMain.handle("editor:originals-search", async (_event, { query, page = 1 }) => {
    return searchOriginalFiles(query, page, { format: "all", era: "" });
  });

  ipcMain.handle("editor:original-compare", async (_event, { localPath, original }) => {
    return compareWithOriginal(localPath, original);
  });

  ipcMain.handle("covers:thumbnail", async (_event, filePath) => {
    return coverThumbnail(filePath);
  });

  ipcMain.handle("covers:preview", async (_event, filePath) => {
    return coverPreview(filePath);
  });

  ipcMain.handle("covers:search", async (_event, { query, page }) => {
    return searchCovers(query, Number(page) || 1);
  });

  ipcMain.handle("tracker:search", async (_event, query) => {
    return searchTrackerDetails(query);
  });

  ipcMain.handle("lyrics:find", async (_event, track) => {
    return findLyricsMatch(track);
  });

  ipcMain.handle("lyrics:get", async (_event, id) => {
    return getLyricsCandidate(id);
  });

  ipcMain.handle("quality:scan", async () => {
    const rootPath = app.getPath("music");
    const token = ++qualityScanToken;
    return scanMusicQuality(rootPath, token);
  });

  ipcMain.handle("quality:cancel", async () => {
    qualityScanToken += 1;
    return true;
  });

  ipcMain.handle("quality:open-spek", async (_event, filePath) => {
    const rootPath = app.getPath("music");
    if (!isInsideDirectory(filePath, rootPath) || !fs.existsSync(filePath)) throw new Error("Arquivo fora da biblioteca de música.");
    const spekPath = SPEK_PATHS.find((candidate) => candidate && fs.existsSync(candidate));
    if (!spekPath) throw new Error("Spek não foi encontrado neste computador.");
    const child = spawn(spekPath, [filePath], { detached: true, stdio: "ignore", windowsHide: false });
    child.unref();
    return true;
  });

  ipcMain.handle("quality:show-file", async (_event, filePath) => {
    const rootPath = app.getPath("music");
    if (!isInsideDirectory(filePath, rootPath) || !fs.existsSync(filePath)) throw new Error("Arquivo fora da biblioteca de música.");
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle("catalog:download", async (_event, song) => {
    if (!song?.path) throw new Error("Esta música não possui arquivo disponível.");
    const suggested = cleanStem(path.basename(song.path), "music");
    const result = await dialog.showSaveDialog(mainWindow, { title: "Baixar música", defaultPath: path.join(app.getPath("downloads"), suggested) });
    if (result.canceled || !result.filePath) return null;
    await downloadApiFile(song.path, result.filePath);
    return result.filePath;
  });

  ipcMain.handle("catalog:download-queue", async (_event, songs = []) => {
    const queue = songs
      .filter((song) => song?.path)
      .slice(0, 200);
    if (!queue.length) throw new Error("Selecione pelo menos uma música disponível.");
    const folder = await dialog.showOpenDialog(mainWindow, {
      title: "Escolher pasta para os downloads",
      defaultPath: app.getPath("downloads"),
      properties: ["openDirectory", "createDirectory"]
    });
    if (folder.canceled || !folder.filePaths[0]) return null;
    const directory = folder.filePaths[0];
    const results = [];
    for (let index = 0; index < queue.length; index += 1) {
      const song = queue[index];
      mainWindow.webContents.send("catalog:queue-progress", {
        index,
        total: queue.length,
        title: song.name || path.basename(song.path)
      });
      try {
        const fileName = cleanStem(path.basename(song.path), `music-${index + 1}`);
        const outputPath = uniqueDownloadPath(path.join(directory, fileName));
        await downloadApiFile(song.path, outputPath);
        results.push({ id: song.id, path: song.path, ok: true, outputPath });
      } catch (error) {
        results.push({ id: song.id, path: song.path, ok: false, error: error.message });
      }
    }
    mainWindow.webContents.send("catalog:queue-progress", {
      done: true,
      total: queue.length
    });
    return { directory, results };
  });

  ipcMain.handle("external:open", async (_event, url) => {
    if (!/^https:\/\/(juicewrldapi\.com|docs\.google\.com)\//i.test(url)) throw new Error("Endereço externo não permitido.");
    await shell.openExternal(url);
    return true;
  });
}

module.exports = {
  browseFiles,
  loadTracker,
  probeAudio,
  processTrack,
  searchTrackerDetails,
  findLyricsMatch,
  getLyricsCandidate,
  analyzeQualityFile,
  classifyQuality,
  spectralEvidence,
  searchOriginalFiles,
  compareWithOriginal,
  decodedAudioHash,
  encodedAudioHash,
  trackFromPath
};
