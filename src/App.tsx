import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronRight, Crown, Gamepad2, MoveUpRight, RotateCcw, ShieldCheck, Sparkles, Trophy, Volume2, Zap } from 'lucide-react';
import { applyAnswer, canAdvanceGame, formatElapsed, getAnswerSoundSequence, getBoardCells, getBoostGain, getMoveIntervalMs, getPenalty, GRID_SIZE, isCollision, moveSnake, randomApple, type Direction, type Point } from './game';
import { getRoutePath } from './routing';
import { getCountdownLabel, getQuizKeyAction, getSafeDirection, isReverseDirection, restoreGamePhase, type GamePhase } from './gameFlow';
import { endPlaySnapshot, getOrCreatePlayerId, parsePlaySnapshot, playPath, serializePlaySnapshot, snapshotKey } from './playSession';

type Question = { id: string; question: string; answers: string[]; correctIndex: number };
type Score = { name: string; length: number; correct: number; questions: number; durationSeconds: number };
type Play = { id: string; name: string; playerId: string; startedAt: string; finishedAt?: string; length: number; questions: number; correct: number; durationSeconds: number; status: string };
const initialSnake: Point[] = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];

let muted = false;
function sound(name: string): Promise<void> {
  if (muted) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let fallbackStarted = false;
    let timeout = 0;
    const finish = () => { if (!settled) { settled = true; window.clearTimeout(timeout); resolve(); } };
    const fallback = () => {
      if (fallbackStarted || settled) return;
      fallbackStarted = true;
      try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = name === 'correct' || name === 'combo' ? 660 : name === 'speed' ? 880 : 180;
        gain.gain.setValueAtTime(0.12, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.onended = () => { void context.close(); finish(); };
        oscillator.start(); oscillator.stop(context.currentTime + 0.16);
      } catch { finish(); }
    };
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.volume = 0.45;
    audio.onended = finish;
    audio.onerror = fallback;
    timeout = window.setTimeout(finish, 1200);
    audio.play().catch(fallback);
  });
}

let soundQueue = Promise.resolve();
function playSoundSequence(names: string[]) {
  soundQueue = soundQueue.then(async () => { for (const name of names) await sound(name); }).catch(() => {});
}

function useRoute() {
  const [route, setRoute] = useState(getRoutePath(location.pathname));
  useEffect(() => { const change = () => setRoute(getRoutePath(location.pathname)); window.addEventListener('popstate', change); return () => window.removeEventListener('popstate', change); }, []);
  const go = (path: string) => { history.pushState({}, '', path); setRoute(getRoutePath(path)); window.scrollTo(0, 0); };
  return { route, go };
}

export default function App() {
  const { route, go } = useRoute();
  const [name, setName] = useState(() => localStorage.getItem('snakeQuiz.name') ?? '');
  const [playerId] = useState(() => getOrCreatePlayerId(localStorage, () => crypto.randomUUID()));
  const [remaining, setRemaining] = useState<number | null>(null);
  const [scores, setScores] = useState<Score[]>([]); const [notice, setNotice] = useState('');
  const loadScores = useCallback(() => fetch('/api/leaderboard').then((r) => r.ok ? r.json() as Promise<Score[]> : []).then(setScores).catch(() => setScores([])), []);
  useEffect(() => {
    void loadScores();
    const polling = window.setInterval(() => { void loadScores(); }, 5_000);
    return () => window.clearInterval(polling);
  }, [loadScores]);
  useEffect(() => { localStorage.setItem('snakeQuiz.name', name); }, [name]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/attempts/${encodeURIComponent(playerId)}`, { signal: controller.signal }).then((r) => r.json()).then((body: { remaining: number }) => setRemaining(body.remaining)).catch(() => {});
    return () => controller.abort();
  }, [playerId, route]);
  if (route === '/admin') return <Admin go={go} />;
  if (route === '/play') return <Game key={new URLSearchParams(location.search).get('id') ?? 'missing'} go={go} player={name.trim()} playerId={playerId} onDone={loadScores} />;
  const start = async (event: React.FormEvent) => {
    event.preventDefault(); setNotice('');
    try {
      const response = await fetch('/api/plays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, playerId }) });
      const body = await response.json();
      if (!response.ok) return setNotice(body.error ?? 'Chưa thể bắt đầu.');
      go(playPath(body.id));
    } catch { setNotice('Không kết nối được máy chủ. Hãy chạy ứng dụng bằng npm run dev.'); }
  };
  return <main className="home-shell">
    <header className="topbar"><a className="brand" href="/" onClick={(e) => { e.preventDefault(); go('/'); }}><span className="brand-mark"><Gamepad2 size={20} /></span><span>SNAKE<span className="brand-accent">QUIZ</span></span></a><div className="top-links"><span className="online"><i /> ARCADE ĐANG MỞ</span><button className="admin-link" onClick={() => go('/admin')}><ShieldCheck size={15} /> Quản trị</button></div></header>
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><Sparkles size={14} /> ARCADE QUIZ CHALLENGE</div><h1>Ăn táo.<br /><span>Đáp nhanh.</span><br />Lên bảng.</h1><p>Rắn càng dài, thử thách càng khó.<br />Bạn trụ được bao lâu?</p>
        <div className="hero-badges"><span><Zap size={13} /> Phản xạ nhanh</span><span><Trophy size={13} /> Bảng xếp hạng</span></div>
      </div>
      <div className="hero-visual" aria-label="Minh họa rắn arcade"><div className="visual-glow" /><div className="pixel-grid" />
        <div className="float-card float-card-left"><span className="mini-apple">✦</span><div><b>+1 KHÚC</b><small>Trả lời chính xác</small></div></div>
        <div className="snake-demo"><span className="snake-piece eye-piece">●</span><span className="snake-piece"> </span><span className="snake-piece"> </span><span className="snake-piece"> </span><span className="snake-piece tail-piece"> </span></div>
        <div className="demo-apple">✿</div><div className="float-card float-card-right"><Zap size={15} /><div><b>5.0s</b><small>Tốc độ hiện tại</small></div></div>
        <div className="visual-caption"><span>01</span> READY, PLAYER ONE <MoveUpRight size={13} /></div>
      </div>
    </section>
    <section className="play-area"><div className="entry-card"><div className="card-heading"><div className="heading-icon"><Gamepad2 size={19} /></div><div><h2>Vào cuộc chơi</h2><p>Mỗi người chơi có tối đa 4 lượt.</p></div></div>
      <form onSubmit={start}><label>HỌ VÀ TÊN<input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Nguyễn Minh Anh" /></label>{remaining !== null && <div className="attempt-count">Còn <b>{remaining}</b> lượt chơi</div>}{notice && <div className="notice">{notice}</div>}<button className="start-button" disabled={remaining === 0}>Bắt đầu chơi <ChevronRight size={17} /></button></form>
      <div className="entry-foot"><ShieldCheck size={14} /> 4 lượt được ghi theo trình duyệt này. Đổi trình duyệt hoặc xóa dữ liệu sẽ tạo danh tính mới.</div>
    </div>
    <div className="leader-card"><div className="leader-head"><div><div className="section-kicker">TOP RUNNERS</div><h2>Bảng xếp hạng</h2></div><span className="live-pill">MÙA GIẢI 01</span></div><div className="leader-columns"><span>HẠNG · NGƯỜI CHƠI</span><span>CHIỀU DÀI</span></div>
      {scores.length ? scores.slice(0, 5).map((score, i) => <div className="leader-row" key={`${score.name}-${i}`}><span className={`rank rank-${i + 1}`}>{i === 0 ? <Crown size={15} /> : String(i + 1).padStart(2, '0')}</span><span className="leader-name">{score.name}<small>{score.correct}/{score.questions} câu đúng</small></span><span className="score-pill">{score.length}<small> KHÚC</small></span></div>) : <div className="empty-rank"><span className="empty-icon"><Trophy size={17} /></span><span><b>Chưa có kỷ lục nào</b><small>Hãy là người đầu tiên lên bảng!</small></span><ChevronRight size={16} /></div>}
      <button className="leader-cta" onClick={() => document.querySelector<HTMLInputElement>('input')?.focus()}>Thử sức ngay <MoveUpRight size={14} /></button>
    </div></section>
    <section className="how-strip"><div className="how-title"><span className="section-kicker">LUẬT CHƠI</span><b>Ba bước.<br />Một kỷ lục.</b></div>{[{n:'01',t:'Di chuyển',d:'Dùng phím mũi tên để lái rắn.'},{n:'02',t:'Ăn táo',d:'Mỗi quả táo mở một câu hỏi.'},{n:'03',t:'Trả lời',d:'Đúng để dài thêm. Sai để bị rút ngắn.'}].map((item) => <div className="how-item" key={item.n}><span>{item.n}</span><b>{item.t}</b><small>{item.d}</small></div>)}</section>
    <footer className="footer"><span>© 2025 SNAKE QUIZ ARCADE</span><span>HỌC TẬP · PHẢN XẠ · GIẢI TRÍ</span><span className="footer-status"><i /> ALL SYSTEMS GO</span></footer>
  </main>;
}

function directionName(direction: Direction): string {
  return direction.x === 1 ? '→ phải' : direction.x === -1 ? '← trái' : direction.y === 1 ? '↓ xuống' : '↑ lên';
}

function Game({ go, player, playerId, onDone }: { go: (path: string) => void; player: string; playerId: string; onDone: () => void }) {
  const requestedId = new URLSearchParams(location.search).get('id') ?? '';
  const [resumeSnapshot] = useState(() => parsePlaySnapshot(sessionStorage.getItem(snapshotKey(requestedId))));
  const startingSnake = resumeSnapshot?.snake ?? initialSnake;
  const [snake, setSnake] = useState<Point[]>(startingSnake);
  const snakeRef = useRef<Point[]>(startingSnake);
  const [apple, setApple] = useState<Point | null>(resumeSnapshot ? resumeSnapshot.apple : { x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>(resumeSnapshot?.direction ?? { x: 1, y: 0 });
  const directionRef = useRef(direction);
  const [questionIndex, setQuestionIndex] = useState(resumeSnapshot?.questionIndex ?? 0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quiz, setQuiz] = useState<Question | null>(null);
  const quizRef = useRef<Question | null>(null);
  const restoredPhase = resumeSnapshot ? restoreGamePhase(resumeSnapshot) : 'playing';
  const [phase, setPhase] = useState<GamePhase>(restoredPhase);
  const phaseRef = useRef<GamePhase>(restoredPhase);
  const transitionTo = (next: GamePhase) => { phaseRef.current = next; setPhase(next); };
  const [directionNotice, setDirectionNotice] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState(0);
  const [feedbackStartedAt, setFeedbackStartedAt] = useState(resumeSnapshot?.feedbackStartedAt);
  const [countdownStartedAt, setCountdownStartedAt] = useState(resumeSnapshot?.countdownStartedAt);
  const [countdownLabel, setCountdownLabel] = useState(() => resumeSnapshot?.countdownStartedAt === undefined ? '2' : getCountdownLabel(Date.now() - resumeSnapshot.countdownStartedAt) ?? '2');
  const [boostSeconds, setBoostSeconds] = useState(resumeSnapshot?.boostSeconds ?? 0);
  const [correct, setCorrect] = useState(resumeSnapshot?.correct ?? 0);
  const [streak, setStreak] = useState(resumeSnapshot?.streak ?? 0);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(resumeSnapshot?.result ?? null);
  const gameOver = phase === 'game-over';
  const [alreadyEnded, setAlreadyEnded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playId, setPlayId] = useState('');
  const [length, setLength] = useState(startingSnake.length);
  const [recorded, setRecorded] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saveRetry, setSaveRetry] = useState(0);
  const lastSaveAttempt = useRef(-1);
  const [playerName, setPlayerName] = useState(player);
  const [attemptPlayerId, setAttemptPlayerId] = useState(playerId);
  const [isMuted, setIsMuted] = useState(muted);
  const startAt = useRef(resumeSnapshot?.startedAt ?? Date.now());

  useEffect(() => {
    let active = true;
    const id = requestedId;
    fetch(`/api/plays/${encodeURIComponent(id)}`).then((response) => {
      if (response.status === 410) {
        sessionStorage.removeItem(snapshotKey(id));
        setAlreadyEnded(true);
        setSaveError('Lượt chơi này đã kết thúc trên máy chủ.');
        transitionTo('game-over');
        void fetch(`/api/attempts/${encodeURIComponent(playerId)}`).then((attempts) => attempts.json()).then((value: { remaining: number }) => setRemaining(value.remaining)).catch(() => {});
      }
      if (!response.ok) throw new Error('Lượt chơi không tồn tại.');
      return response.json() as Promise<{ id: string; name: string; playerId: string; startedAt: string; questions: Question[] }>;
    }).then((play) => {
      if (!active) return;
      setPlayId(play.id);
      setQuestions(play.questions);
      setPlayerName(play.name || player);
      setAttemptPlayerId(play.playerId || playerId);
      if (!resumeSnapshot) startAt.current = Date.parse(play.startedAt) || Date.now();
      if (phaseRef.current === 'quiz' || phaseRef.current === 'feedback') {
        const quizIndex = phaseRef.current === 'feedback' ? Math.max(0, (resumeSnapshot?.questionIndex ?? 1) - 1) : resumeSnapshot?.questionIndex ?? 0;
        setQuiz(play.questions[quizIndex % play.questions.length] ?? null);
      }
    }).catch(() => { if (active) transitionTo('game-over'); });
    return () => { active = false; };
  }, [playerId, player, requestedId, resumeSnapshot]);

  useEffect(() => {
    if (!playId) return;
    const key = snapshotKey(playId);
    if (recorded) { sessionStorage.removeItem(key); return; }
    const snapshot = { snake, apple, direction, questionIndex, boostSeconds, correct, streak, startedAt: startAt.current, gameOver, phase, result, feedbackStartedAt, countdownStartedAt };
    sessionStorage.setItem(key, serializePlaySnapshot(gameOver ? endPlaySnapshot(snapshot) : snapshot));
  }, [apple, boostSeconds, correct, direction, gameOver, phase, result, feedbackStartedAt, countdownStartedAt, playId, questionIndex, recorded, snake, streak]);

  useEffect(() => { quizRef.current = quiz; }, [quiz]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const map: Record<string, Direction> = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };
      const currentPhase = phaseRef.current;
      if (currentPhase === 'quiz') {
        const action = getQuizKeyAction(event.code || event.key, quizRef.current?.answers.length ?? 0, selectedAnswer, Boolean(result));
        if (action.type !== 'none' || ['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key) || /^Key[A-D]$/.test(event.code)) event.preventDefault();
        if (action.type === 'select') setSelectedAnswer(action.index);
        if (action.type === 'answer') answer(action.index);
        return;
      }
      if (currentPhase === 'feedback') {
        if (event.key.startsWith('Arrow') || /^Key[A-D]$/.test(event.code) || event.key === 'Enter') event.preventDefault();
        return;
      }
      const next = map[event.key];
      if (!next) return;
      event.preventDefault();
      if (currentPhase !== 'game-over' && !isReverseDirection(directionRef.current, next)) {
        directionRef.current = next;
        setDirection(next);
        if (currentPhase === 'countdown') setDirectionNotice('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, selectedAnswer, result, quiz]);

  useEffect(() => {
    if (!canAdvanceGame({ quizOpen: phase === 'quiz' || phase === 'feedback', paused: phase === 'countdown', gameOver, playLoaded: Boolean(playId), appleReady: Boolean(apple) })) return;
    if (!apple) return;
    const intervalMs = getMoveIntervalMs(boostSeconds > 0);
    const interval = window.setInterval(() => {
      const current = snakeRef.current;
      const next = moveSnake(current, directionRef.current, false);
      if (isCollision(next, GRID_SIZE, GRID_SIZE)) {
        transitionTo('game-over');
        playSoundSequence(['game-over']);
        return;
      }
      snakeRef.current = next;
      setSnake(next);
      setLength(next.length);
      if (next[0].x === apple.x && next[0].y === apple.y) {
        setApple(null);
        setQuiz(questions[questionIndex % questions.length] ?? null);
        setSelectedAnswer(0);
        transitionTo('quiz');
      }
      if (boostSeconds > 0) setBoostSeconds((value) => Math.max(0, value - intervalMs / 1000));
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [apple, boostSeconds, gameOver, phase, playId, questionIndex, questions]);

  useEffect(() => {
    if (phase !== 'feedback' || !playId) return;
    if (feedbackStartedAt === undefined) { setFeedbackStartedAt(Date.now()); return; }
    const remainingMs = Math.max(0, 700 - (Date.now() - feedbackStartedAt));
    const timeout = window.setTimeout(() => {
      setQuiz(null);
      quizRef.current = null;
      setResult(null);
      setFeedbackStartedAt(undefined);
      const now = Date.now();
      setCountdownStartedAt(now);
      setCountdownLabel('2');
      transitionTo('countdown');
    }, remainingMs);
    return () => window.clearTimeout(timeout);
  }, [feedbackStartedAt, phase, playId]);

  useEffect(() => {
    if (phase !== 'countdown' || !playId) return;
    if (countdownStartedAt === undefined) { setCountdownStartedAt(Date.now()); return; }
    const elapsed = Date.now() - countdownStartedAt;
    const label = getCountdownLabel(elapsed);
    setCountdownLabel(label ?? 'GO!');
    if (!label) { transitionTo('playing'); setCountdownStartedAt(undefined); return; }
    const nextBoundary = label === '2' ? 667 : label === '1' ? 1334 : 2000;
    const timeout = window.setTimeout(() => {
      const nextLabel = getCountdownLabel(Date.now() - countdownStartedAt);
      if (!nextLabel) { transitionTo('playing'); setCountdownStartedAt(undefined); }
      else setCountdownLabel(nextLabel);
    }, Math.max(0, nextBoundary - elapsed));
    return () => window.clearTimeout(timeout);
  }, [countdownStartedAt, phase, countdownLabel, playId]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const safe = getSafeDirection(snakeRef.current, directionRef.current);
    if (!safe) { transitionTo('game-over'); playSoundSequence(['game-over']); return; }
    if (safe.x !== directionRef.current.x || safe.y !== directionRef.current.y) {
      directionRef.current = safe;
      setDirection(safe);
      setDirectionNotice(`Hướng không an toàn, đã tự đổi sang ${directionName(safe)}.`);
    }
  }, [direction, phase, snake]);

  useEffect(() => {
    if (!playId || gameOver) return;
    const heartbeat = window.setInterval(() => {
      void fetch(`/api/plays/${playId}/heartbeat`, { method: 'POST' }).catch(() => {});
    }, 15_000);
    return () => window.clearInterval(heartbeat);
  }, [gameOver, playId]);

  useEffect(() => {
    if (!gameOver || !playId || recorded || saving || lastSaveAttempt.current >= saveRetry) return;
    lastSaveAttempt.current = saveRetry;
    setSaving(true);
    setSaveError('');
    fetch(`/api/plays/${playId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ length, questions: questionIndex, correct, durationSeconds: Math.floor((Date.now() - startAt.current) / 1000), status: 'game-over' }),
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          setAlreadyEnded(true);
          void fetch(`/api/attempts/${encodeURIComponent(attemptPlayerId)}`).then((attempts) => attempts.json()).then((value: { remaining: number }) => setRemaining(value.remaining)).catch(() => {});
        }
        throw new Error(body.error ?? 'Không lưu được kết quả.');
      }
      setRecorded(true);
      setSaveError('');
      await onDone();
      const attempts = await fetch(`/api/attempts/${encodeURIComponent(attemptPlayerId)}`).catch(() => null);
      if (attempts?.ok) {
        const value = await attempts.json() as { remaining: number };
        setRemaining(value.remaining);
      }
    }).catch((error: unknown) => {
      setSaveError(error instanceof Error ? error.message : 'Không lưu được kết quả.');
    }).finally(() => {
      setSaving(false);
    });
  }, [attemptPlayerId, correct, gameOver, length, onDone, playId, questionIndex, recorded, saveRetry, saving]);

  const answer = (answerIndex: number) => {
    if (!quiz || phaseRef.current !== 'quiz') return;
    phaseRef.current = 'feedback';
    setPhase('feedback');
    const right = answerIndex === quiz.correctIndex;
    const totalQuestions = questionIndex + 1;
    const nextSnake = applyAnswer(snakeRef.current, right, getPenalty(totalQuestions));
    snakeRef.current = nextSnake;
    setSnake(nextSnake);
    setLength(nextSnake.length);
    setQuestionIndex(totalQuestions);
    setResult(right ? 'correct' : 'wrong');
    setFeedbackStartedAt(Date.now());
    if (right) {
      setCorrect((value) => value + 1);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      const bonus = getBoostGain(totalQuestions, nextStreak);
      setBoostSeconds((value) => value + bonus);
      playSoundSequence(getAnswerSoundSequence(nextStreak));
    } else {
      setStreak(0);
      playSoundSequence(['wrong']);
    }
    if (nextSnake.length === 0) {
      setQuiz(null);
      quizRef.current = null;
      transitionTo('game-over');
      playSoundSequence(['game-over']);
      return;
    }
    setApple(randomApple(nextSnake));
  };

  const replay = async () => {
    try {
      const response = await fetch('/api/plays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: playerName, playerId: attemptPlayerId }) });
      const body = await response.json();
      if (!response.ok) { setRemaining(0); return; }
      go(playPath(body.id));
    } catch { setRemaining(0); }
  };

  const quit = () => { transitionTo('game-over'); playSoundSequence(['game-over']); };
  return <main className="game-shell">
    <header className="game-top">
      <button className="brand" onClick={() => go('/')}><span className="brand-mark"><Gamepad2 size={20} /></span><span>SNAKE<span className="brand-accent">QUIZ</span></span></button>
      <div className="game-player"><span className="player-dot">{playerName.slice(0,1).toUpperCase()}</span><b>{playerName}</b><button onClick={quit} aria-label="Kết thúc lượt" className="exit-button">Thoát</button></div>
    </header>
    <div className="game-layout">
      <section className="board-column">
        <div className="game-titleline"><div><span className="section-kicker">ARCADE RUN · SOLO</span><h1>Chơi thật tốt.</h1></div><span className={`playing-pill${phase === 'countdown' ? ' paused-pill' : ''}`}><i /> {phase === 'game-over' ? 'ĐÃ KẾT THÚC' : phase === 'quiz' ? 'QUIZ' : phase === 'feedback' ? 'KẾT QUẢ' : phase === 'countdown' ? 'SẮP CHẠY' : 'ĐANG CHƠI'}</span></div>
        <div className="board-frame">
          <div className="board-topline"><span>PLAYER 01 <b>●</b></span><span>ARENA <b>20×20</b></span><span>LVL <b>{Math.floor(questionIndex / 10) + 1}</b></span></div>
          <div className="board" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
            {getBoardCells(snake, apple).map(({x, y, snakeIndex: index, apple: isApple}) => <div className={`cell${index === 0 ? ` snake-head dir-${direction.x === 1 ? 'right' : direction.x === -1 ? 'left' : direction.y === 1 ? 'down' : 'up'}` : index > 0 ? ` snake-body${index === snake.length - 1 ? ' snake-tail' : ''}` : ''}${isApple ? ' apple-cell' : ''}`} key={`${x}-${y}`}>{isApple && <span className="apple-art"><i className="apple-stem" /><i className="apple-leaf" /></span>}</div>)}
          </div>
          {quiz && (phase === 'quiz' || phase === 'feedback') && <div className="quiz-overlay"><div className="quiz-modal">
            <span className="quiz-tag"><Sparkles size={13} /> CÂU HỎI {phase === 'feedback' ? questionIndex : questionIndex + 1}</span><h2>{quiz.question}</h2>
            <div className="answer-list">{quiz.answers.map((answerText, i) => <button key={answerText} disabled={phase !== 'quiz'} onClick={() => answer(i)} className={`answer-option${selectedAnswer === i && phase === 'quiz' ? ' answer-selected' : ''}${result === 'correct' && i === quiz.correctIndex ? ' answer-correct' : ''}`}><span>{String.fromCharCode(65+i)}</span>{answerText}{result === 'correct' && i === quiz.correctIndex && <Check size={16} />}</button>)}</div>
            {phase === 'quiz' && <p className="quiz-key-hint">A / B / C / D trả lời trực tiếp · ↑ ↓ chọn · Enter xác nhận</p>}
            {result && <div className={`answer-result ${result}`} role="status">{result === 'correct' ? 'Chính xác! Rắn dài thêm một khúc.' : `Chưa đúng. Rắn mất ${getPenalty(questionIndex)} khúc.`}</div>}
          </div></div>}
          {phase === 'countdown' && <div className="countdown-overlay" role="status" aria-live="assertive"><div className="countdown-card"><span className="quiz-tag"><Zap size={14} /> SẴN SÀNG</span><strong key={countdownLabel} className="countdown-number">{countdownLabel}</strong><p>{directionNotice || `Hướng tiếp theo: ${directionName(direction)}`}</p><small>Dùng phím mũi tên để chọn hướng</small></div></div>}
          {gameOver && <div className="quiz-overlay"><div className="quiz-modal gameover-modal"><span className="over-icon"><Trophy size={23} /></span><span className="quiz-tag">LƯỢT CHƠI ĐÃ KẾT THÚC</span><h2>Game Over</h2><p>Rắn sống được {formatElapsed(Math.floor((Date.now() - startAt.current) / 1000))}. Bạn trả lời đúng {correct} câu.</p><div className="final-score"><span>CHIỀU DÀI CUỐI</span><b>{length} <small>KHÚC</small></b></div><p className="attempt-count">{saving ? 'Đang lưu lượt chơi…' : remaining === null ? 'Đang cập nhật lượt còn lại…' : `Còn ${remaining} lượt chơi`}</p>{saveError && !recorded && <p className="notice" role="alert">{saveError}</p>}{saveError && !recorded && !alreadyEnded && <button className="start-button replay-button" disabled={saving} onClick={() => setSaveRetry((value) => value + 1)}>{saving ? 'Đang thử lưu…' : 'Thử lưu lại'}</button>}{remaining !== null && remaining > 0 && (recorded || alreadyEnded) && <button className="start-button replay-button" onClick={() => void replay()}>Chơi lại <RotateCcw size={15} /></button>}<button className="start-button home-button" onClick={() => go('/')}>Về trang chủ <ChevronRight size={17} /></button></div></div>}
        </div>
        <div className="board-hint"><span><span className="keycap">↑</span><span className="keycap"><ArrowLeft size={12} /></span><span className="keycap"><ArrowDown size={12} /></span><span className="keycap"><ArrowRight size={12} /></span> DI CHUYỂN · QUIZ: A/B/C/D HOẶC ↑ ↓ + ENTER</span><span>CHẠM TÁO ĐỂ TRẢ LỜI</span></div>
      </section>
      <aside className="game-sidebar">
        <div className={`stat-card boost-stat${boostSeconds > 0 ? ' boost-active' : ''}`}><span><Zap size={16} /> THỜI GIAN TĂNG TỐC</span><b>{boostSeconds.toFixed(1)}<small> s</small></b><small>{phase === 'quiz' || phase === 'feedback' || phase === 'countdown' ? 'Tạm dừng · thời gian được giữ nguyên' : boostSeconds > 0 ? 'Boost đang chạy · 175ms/ô' : 'Combo đúng để kích hoạt boost'}</small><div className="boost-meter"><i style={{ width: `${Math.min(100, boostSeconds / 20 * 100)}%` }} /></div></div>
        <div className="stat-card"><span><Sparkles size={16} /> CHIỀU DÀI</span><b>{length}<small> khúc</small></b><div className="meter"><i style={{ width: `${Math.min(100, length * 5)}%` }} /></div></div>
        <div className="stat-card"><span><Check size={16} /> CÂU ĐÚNG</span><b>{correct}<small> câu</small></b><small>{streak > 1 ? `${streak} câu liên tiếp!` : 'Mỗi đáp án đúng giúp rắn dài ra.'}</small></div>
        <div className="rules-card"><span className="section-kicker">COMBO BOOST</span>{[[5,'+1.5s'],[10,'+3s'],[20,'+5s']].map(([count,bonus])=><div className="combo-row" key={count}><span>{count} đúng liên tiếp</span><b>{bonus}</b></div>)}<div className="speed-note"><Zap size={14} /> TỐC ĐỘ {boostSeconds > 0 ? '175' : '260'}MS / Ô</div></div>
        <button className="mute-button" onClick={() => { muted = !muted; setIsMuted(muted); }}><Volume2 size={15} /> Âm thanh {isMuted ? 'tắt' : 'bật'}</button>
      </aside>
    </div>
  </main>;
}
function Admin({ go }: { go: (path: string) => void }) {
  const [plays, setPlays] = useState<Play[]>([]);
  const [authorization, setAuthorization] = useState('');
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    const password = window.prompt('Nhập mật khẩu quản trị:');
    if (password === null) { setError('Cần mật khẩu để xem dữ liệu quản trị.'); return; }
    const auth = `Basic ${btoa(`admin:${password}`)}`;
    setAuthorization(auth);
  }, []);
  useEffect(() => {
    if (!authorization) return;
    let active = true;
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch('/api/admin/plays', { headers: { Authorization: authorization } });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(response.status === 401 ? 'Mật khẩu quản trị không đúng.' : body.error ?? 'Không tải được dữ liệu.');
        }
        const value = await response.json() as Play[];
        if (active) { setPlays(value); setError(''); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu.');
      } finally { loading = false; }
    };
    void load();
    const polling = window.setInterval(() => { void load(); }, 5_000);
    return () => { active = false; window.clearInterval(polling); };
  }, [authorization]);
  const finished = plays.filter((p) => p.status === 'finished' || p.status === 'game-over');
  const records = new Map<string, number>();
  plays.forEach((p) => records.set(p.playerId, (records.get(p.playerId) ?? 0) + 1));
  const exportCsv = async () => {
    const response = await fetch('/api/admin/export.csv', { headers: { Authorization: authorization } });
    if (!response.ok) { setError('Không thể xuất CSV. Kiểm tra mật khẩu quản trị.'); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'snake-quiz-plays.csv'; link.click();
    URL.revokeObjectURL(url);
  };
  const resetPlays = async () => {
    if (!authorization || !window.confirm('Xóa toàn bộ lượt đã lưu và làm trống bảng xếp hạng? Mọi người sẽ được cấp lại 4 lượt chơi.')) return;
    setResetting(true);
    try {
      const response = await fetch('/api/admin/plays', { method: 'DELETE', headers: { Authorization: authorization } });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Không thể reset lượt chơi.');
      }
      setPlays([]);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể reset lượt chơi.');
    } finally { setResetting(false); }
  };
  return <main className="admin-shell"><header className="topbar"><button className="brand" onClick={() => go('/')}><span className="brand-mark"><Gamepad2 size={20} /></span><span>SNAKE<span className="brand-accent">QUIZ</span></span></button><button className="admin-link" onClick={() => go('/')}><ArrowLeft size={15} /> Trang chủ</button></header><div className="admin-content"><div className="admin-heading"><div><span className="section-kicker">ARCADE CONTROL</span><h1>Quản trị lượt chơi</h1><p>Theo dõi kết quả và xuất dữ liệu dự thi.</p></div><div className="admin-actions"><button className="start-button export-button" onClick={() => void exportCsv()} disabled={!authorization}>Xuất CSV <MoveUpRight size={16} /></button><button className="admin-link" onClick={() => void resetPlays()} disabled={!authorization || resetting}>{resetting ? 'Đang reset…' : 'Reset lượt'}</button></div></div>{error && <p className="notice">{error}</p>}<div className="admin-stats"><div className="stat-card"><span>TỔNG LƯỢT</span><b>{plays.length}</b></div><div className="stat-card"><span>ĐÃ HOÀN TẤT</span><b>{finished.length}</b></div><div className="stat-card"><span>NGƯỜI CHƠI</span><b>{records.size}</b></div></div><div className="admin-table-wrap"><table><thead><tr><th>NGƯỜI CHƠI</th><th>ID TRÌNH DUYỆT</th><th>CHIỀU DÀI</th><th>CÂU ĐÚNG</th><th>THỜI GIAN</th><th>TRẠNG THÁI</th></tr></thead><tbody>{plays.slice().reverse().map((p) => <tr key={p.id}><td>{p.name}</td><td className="code-cell">{p.playerId}</td><td>{p.length} khúc</td><td>{p.correct}/{p.questions}</td><td>{formatElapsed(p.durationSeconds)}</td><td><span className={`status-tag ${p.status}`}>{p.status === 'abandoned' ? 'Bỏ dở' : p.status === 'playing' ? 'Đang chơi' : p.status === 'finished' ? 'Hoàn tất' : 'Game Over'}</span></td></tr>)}</tbody></table>{!plays.length && !error && <div className="empty-admin">Chưa có lượt chơi nào được ghi nhận.</div>}</div></div></main>;
}
