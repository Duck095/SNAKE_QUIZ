import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canSavePlay, canStartAttempt, countAttempts, expirePlayIfIdle, getLeaderboard, validatePlayResult } from './rules.js';
import { createSerialQueue } from './serial.js';
import { createPlayStore, resolveDataDir } from './storage.js';

type Question = { id: string; question: string; answers: string[]; correctIndex: number };
type Play = { id: string; name: string; playerId: string; startedAt: string; lastActiveAt?: string; finishedAt?: string; length: number; questions: number; correct: number; durationSeconds: number; status: 'playing' | 'finished' | 'game-over' | 'abandoned' };
const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(runtimeDir, '..');
const serverRoot = path.join(projectRoot, 'server');
const envFile = path.join(serverRoot, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const store = createPlayStore(resolveDataDir(process.env.DATA_DIR, path.join(serverRoot, 'data')));
const questions = JSON.parse(await readFile(path.join(serverRoot, 'questions.json'), 'utf8')) as Question[];
const app = express();
app.use(express.json({ limit: '32kb' }));
const runExclusive = createSerialQueue();

async function readPlays(): Promise<Play[]> {
  const entries = await store.read<Partial<Play> & { code?: string }>();
  return entries.map((play) => ({ ...play, playerId: play.playerId ?? `legacy-${play.code ?? play.id ?? randomUUID()}` })) as Play[];
}
async function savePlays(plays: Play[]) {
  await store.write(plays);
}
const publicQuestion = ({ id, question, answers, correctIndex }: Question) => ({ id, question, answers, correctIndex });

app.use('/api/admin', (req, res, next) => {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return res.status(503).json({ error: 'Admin chưa được cấu hình: đặt ADMIN_PASSWORD trên server.' });
  const authorization = req.get('authorization') ?? '';
  const supplied = authorization.startsWith('Basic ') ? Buffer.from(authorization.slice(6), 'base64') : Buffer.alloc(0);
  const expected = Buffer.from(`admin:${password}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Snake Quiz Admin"');
    return res.status(401).json({ error: 'Cần mật khẩu quản trị hợp lệ.' });
  }
  return next();
});

app.get('/api/questions', (_req, res) => res.json(questions.map(publicQuestion)));
app.get('/api/attempts/:playerId', async (req, res) => runExclusive(async () => {
  const playerId = String(req.params.playerId ?? '').trim();
  const plays = await readPlays();
  const used = countAttempts(plays, playerId);
  return res.json({ used, remaining: Math.max(0, 4 - used) });
}));
app.post('/api/plays', async (req, res) => runExclusive(async () => {
  const name = String(req.body?.name ?? '').trim().slice(0, 40);
  const playerId = String(req.body?.playerId ?? '').trim().slice(0, 80);
  if (!name || !playerId) return res.status(400).json({ error: 'Nhập họ tên để bắt đầu.' });
  const plays = await readPlays();
  const used = countAttempts(plays, playerId);
  if (!canStartAttempt(used)) return res.status(403).json({ error: 'Bạn đã dùng đủ 4 lượt trên trình duyệt này.' });
  const startedAt = new Date().toISOString();
  const play: Play = { id: randomUUID(), name, playerId, startedAt, lastActiveAt: startedAt, length: 4, questions: 0, correct: 0, durationSeconds: 0, status: 'playing' };
  plays.push(play);
  await savePlays(plays);
  return res.status(201).json({ id: play.id, questions: questions.map(publicQuestion), remaining: 3 - used });
}));
app.get('/api/plays/:id', async (req, res) => runExclusive(async () => {
  const plays = await readPlays();
  const play = plays.find((item) => item.id === req.params.id);
  if (!play) return res.status(404).json({ error: 'Không tìm thấy lượt chơi.' });
  if (expirePlayIfIdle(play)) await savePlays(plays);
  if (play.status !== 'playing') return res.status(410).json({ error: 'Lượt chơi này đã kết thúc.' });
  play.lastActiveAt = new Date().toISOString();
  await savePlays(plays);
  return res.json({ id: play.id, questions: questions.map(publicQuestion), name: play.name, playerId: play.playerId, startedAt: play.startedAt });
}));
app.post('/api/plays/:id/heartbeat', async (req, res) => runExclusive(async () => {
  const plays = await readPlays();
  const play = plays.find((item) => item.id === req.params.id);
  if (play && expirePlayIfIdle(play)) await savePlays(plays);
  if (!play || play.status !== 'playing') return res.status(410).json({ error: 'Lượt chơi đã kết thúc.' });
  play.lastActiveAt = new Date().toISOString();
  await savePlays(plays);
  return res.status(204).end();
}));
app.put('/api/plays/:id', async (req, res) => runExclusive(async () => {
  const plays = await readPlays();
  const play = plays.find((item) => item.id === req.params.id);
  if (!play) return res.status(404).json({ error: 'Không tìm thấy lượt chơi.' });
  if (expirePlayIfIdle(play)) await savePlays(plays);
  if (!canSavePlay(play.status)) return res.status(409).json({ error: 'Lượt chơi đã kết thúc hoặc bị hủy do hết heartbeat.' });
  const body = req.body ?? {};
  const invalid = validatePlayResult(body);
  if (invalid) return res.status(400).json({ error: invalid });
  play.length = body.length;
  play.questions = body.questions;
  play.correct = body.correct;
  play.durationSeconds = body.durationSeconds;
  play.status = body.status === 'finished' ? 'finished' : 'game-over';
  play.finishedAt = new Date().toISOString();
  await savePlays(plays);
  return res.json(play);
}));
app.get('/api/leaderboard', async (_req, res) => runExclusive(async () => {
  return res.json(getLeaderboard(await readPlays()));
}));
app.get('/api/admin/plays', async (_req, res) => runExclusive(async () => res.json(await readPlays())));
app.delete('/api/admin/plays', async (_req, res) => runExclusive(async () => {
  const plays = await readPlays();
  await savePlays([]);
  return res.json({ deleted: plays.length });
}));
app.get('/api/admin/export.csv', async (_req, res) => runExclusive(async () => {
  const plays = await readPlays();
  const cells = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [['id','name','playerId','startedAt','finishedAt','status','length','questions','correct','durationSeconds'], ...plays.map((p) => [p.id,p.name,p.playerId,p.startedAt,p.finishedAt,p.status,p.length,p.questions,p.correct,p.durationSeconds])];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="snake-quiz-plays.csv"');
  return res.send(`\uFEFF${rows.map((row) => row.map(cells).join(',')).join('\r\n')}`);
}));

const port = Number(process.env.PORT ?? 3001);
const dist = path.join(projectRoot, 'dist');
if (existsSync(dist)) { app.use(express.static(dist)); app.use((_req, res) => res.sendFile(path.join(dist, 'index.html'))); }
const stalePlaySweep = setInterval(() => {
  void runExclusive(async () => {
    const plays = await readPlays();
    const now = Date.now();
    let changed = false;
    for (const play of plays) {
      if (expirePlayIfIdle(play, now)) changed = true;
    }
    if (changed) await savePlays(plays);
  }).catch((error) => console.error('Unable to close idle play sessions:', error));
}, 15_000);
stalePlaySweep.unref();
app.listen(port, () => console.log(`Snake Quiz API ready at http://localhost:${port}`));
