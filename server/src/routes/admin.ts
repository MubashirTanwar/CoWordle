import { Router, type RequestHandler } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import mongoose, { type PipelineStage } from 'mongoose';
import { fail, ok } from '../lib/response';
import GameSession from '../models/GameSession';
import Room from '../models/Room';
import SoloResult from '../models/SoloResult';
import type {
  AdminOverview,
  AdminRecords,
  DailyCount,
  GameDetail,
  GameListItem,
  Paged,
  PlayerDetail,
  PlayerSort,
  PlayerSummary,
  RecordEntry,
  WordStat,
} from '../shared/admin';
import type { Guess, Variant } from '../shared/types';

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Only the Next.js server calls these routes (after checking the NextAuth
// session). It proves itself with a shared key the browser never sees.

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

const requireAdminKey: RequestHandler = (req, res, next) => {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return fail(res, 503, 'ADMIN_DISABLED', 'ADMIN_API_KEY is not set on the server');
  const given = req.header('x-admin-key') ?? '';
  if (!safeEqual(given, expected)) return fail(res, 401, 'UNAUTHORIZED', 'Invalid admin key');
  if (mongoose.connection.readyState !== 1) return fail(res, 503, 'DB_NOT_READY', 'Database is still connecting');
  next();
};

// ─── Lean document shapes ─────────────────────────────────────────────────────

interface LeanResult {
  playerId?: string;
  playerName?: string;
  guesses?: Guess[];
  solved?: boolean;
  timeTaken?: number | null;
  points?: number;
}

interface LeanSession {
  _id: mongoose.Types.ObjectId;
  roomCode?: string;
  variant?: Variant;
  hardMode?: boolean;
  createdAt: Date;
  rounds?: { roundNumber?: number; word?: string; timeLimit?: number; playerResults?: LeanResult[] }[];
  finalScores?: { playerId?: string; playerName?: string; totalPoints?: number }[];
}

const DAY = 24 * 60 * 60 * 1000;
const FINISHED = { 'finalScores.0': { $exists: true } };

const round1 = (n: number) => Math.round(n * 10) / 10;
const ratio = (a: number, b: number) => (b ? a / b : 0);
const avg = (sum: number, n: number) => (n ? round1(sum / n) : null);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function cleanGuesses(guesses: Guess[] = []): Guess[] {
  return guesses.map((g) => ({
    word: g.word,
    ...(g.result?.length ? { result: g.result } : {}),
    ...(g.counts ? { counts: { correct: g.counts.correct, present: g.counts.present, absent: g.counts.absent } } : {}),
  }));
}

function toGameListItem(s: LeanSession): GameListItem {
  const finished = (s.finalScores?.length ?? 0) > 0;
  let players: GameListItem['players'];
  if (finished) {
    players = s.finalScores!.map((f) => ({ playerId: f.playerId ?? '', playerName: f.playerName ?? '', totalPoints: f.totalPoints ?? 0 }));
  } else {
    // Abandoned game: total up whatever rounds were played
    const map = new Map<string, GameListItem['players'][number]>();
    for (const r of s.rounds ?? []) {
      for (const pr of r.playerResults ?? []) {
        const id = pr.playerId ?? '';
        const cur = map.get(id) ?? { playerId: id, playerName: pr.playerName ?? '', totalPoints: 0 };
        cur.totalPoints += pr.points ?? 0;
        map.set(id, cur);
      }
    }
    players = [...map.values()].sort((a, b) => b.totalPoints - a.totalPoints);
  }
  const winner = finished && players.length > 1 && players[0].totalPoints > players[1].totalPoints ? players[0] : null;
  return {
    id: s._id.toString(),
    roomCode: s.roomCode ?? '',
    createdAt: s.createdAt.toISOString(),
    variant: s.variant ?? 'classic',
    hardMode: s.hardMode ?? false,
    roundsPlayed: s.rounds?.length ?? 0,
    finished,
    players,
    winner,
  };
}

/** One row per player per round played. */
function playerRoundsPipeline(match: Record<string, unknown> = {}): PipelineStage[] {
  return [
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $unwind: '$rounds' },
    { $unwind: '$rounds.playerResults' },
    ...(match['rounds.playerResults.playerId'] ? [{ $match: { 'rounds.playerResults.playerId': match['rounds.playerResults.playerId'] } }] : []),
    {
      $project: {
        createdAt: 1,
        word: '$rounds.word',
        playerId: '$rounds.playerResults.playerId',
        playerName: '$rounds.playerResults.playerName',
        solved: '$rounds.playerResults.solved',
        points: '$rounds.playerResults.points',
        timeTaken: '$rounds.playerResults.timeTaken',
        tries: { $size: { $ifNull: ['$rounds.playerResults.guesses', []] } },
        firstGuess: { $arrayElemAt: ['$rounds.playerResults.guesses.word', 0] },
      },
    },
  ];
}

// ─── Player stats ─────────────────────────────────────────────────────────────

async function buildPlayerSummaries(playerId?: string): Promise<Map<string, PlayerSummary>> {
  const prMatch = playerId ? { 'rounds.playerResults.playerId': playerId } : {};

  const [roundStats, gameStats, soloStats] = await Promise.all([
    GameSession.aggregate<{
      _id: string; rounds: number; solved: number; triesSum: number; timeSum: number; timeN: number;
      points: number; names: string[]; lastName: string; lastSeen: Date; firstSeen: Date;
    }>([
      ...playerRoundsPipeline(prMatch),
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$playerId',
          rounds: { $sum: 1 },
          solved: { $sum: { $cond: ['$solved', 1, 0] } },
          triesSum: { $sum: { $cond: ['$solved', '$tries', 0] } },
          timeSum: { $sum: { $cond: ['$solved', { $ifNull: ['$timeTaken', 0] }, 0] } },
          timeN: { $sum: { $cond: [{ $and: ['$solved', { $ne: ['$timeTaken', null] }] }, 1, 0] } },
          points: { $sum: { $ifNull: ['$points', 0] } },
          names: { $addToSet: '$playerName' },
          lastName: { $last: '$playerName' },
          lastSeen: { $max: '$createdAt' },
          firstSeen: { $min: '$createdAt' },
        },
      },
    ]),
    GameSession.aggregate<{ _id: string; games: number; wins: number }>([
      { $match: { ...FINISHED, ...(playerId ? { 'finalScores.playerId': playerId } : {}) } },
      {
        $project: {
          finalScores: 1,
          n: { $size: '$finalScores' },
          top: { $arrayElemAt: ['$finalScores.totalPoints', 0] },
          second: { $arrayElemAt: ['$finalScores.totalPoints', 1] },
        },
      },
      { $unwind: { path: '$finalScores', includeArrayIndex: 'rank' } },
      ...(playerId ? [{ $match: { 'finalScores.playerId': playerId } }] : []),
      {
        $group: {
          _id: '$finalScores.playerId',
          games: { $sum: 1 },
          wins: { $sum: { $cond: [{ $and: [{ $eq: ['$rank', 0] }, { $gt: ['$n', 1] }, { $gt: ['$top', '$second'] }] }, 1, 0] } },
        },
      },
    ]),
    SoloResult.aggregate<{ _id: string; soloGames: number; soloSolved: number; lastSeen: Date; firstSeen: Date; names: string[]; lastName: string | null }>([
      { $match: playerId ? { playerId } : { playerId: { $type: 'string' } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$playerId',
          soloGames: { $sum: 1 },
          soloSolved: { $sum: { $cond: ['$solved', 1, 0] } },
          lastSeen: { $max: '$createdAt' },
          firstSeen: { $min: '$createdAt' },
          names: { $addToSet: '$playerName' },
          lastName: { $last: '$playerName' },
        },
      },
    ]),
  ]);

  const map = new Map<string, PlayerSummary & { firstSeen: string }>();
  const get = (id: string) => {
    let p = map.get(id);
    if (!p) {
      p = {
        playerId: id, playerName: '', names: [], games: 0, wins: 0, totalPoints: 0, rounds: 0, solved: 0,
        solveRate: 0, avgTries: null, avgSolveTime: null, soloGames: 0, soloSolved: 0,
        lastSeen: new Date(0).toISOString(), firstSeen: new Date().toISOString(),
      };
      map.set(id, p);
    }
    return p;
  };
  const seen = (p: PlayerSummary & { firstSeen: string }, last: Date, first: Date) => {
    if (last.toISOString() > p.lastSeen) p.lastSeen = last.toISOString();
    if (first.toISOString() < p.firstSeen) p.firstSeen = first.toISOString();
  };

  for (const r of roundStats) {
    if (!r._id) continue;
    const p = get(r._id);
    Object.assign(p, {
      rounds: r.rounds,
      solved: r.solved,
      totalPoints: r.points,
      solveRate: ratio(r.solved, r.rounds),
      avgTries: avg(r.triesSum, r.solved),
      avgSolveTime: avg(r.timeSum, r.timeN),
      playerName: r.lastName ?? '',
      names: r.names.filter(Boolean),
    });
    seen(p, r.lastSeen, r.firstSeen);
  }
  for (const g of gameStats) {
    if (!g._id) continue;
    const p = get(g._id);
    p.games = g.games;
    p.wins = g.wins;
  }
  for (const s of soloStats) {
    if (!s._id) continue;
    const p = get(s._id);
    p.soloGames = s.soloGames;
    p.soloSolved = s.soloSolved;
    for (const n of s.names) if (n && !p.names.includes(n)) p.names.push(n);
    // Prefer whichever name was used most recently
    if (!p.playerName || s.lastSeen.toISOString() > p.lastSeen) p.playerName = s.lastName || p.playerName;
    seen(p, s.lastSeen, s.firstSeen);
  }
  for (const p of map.values()) if (!p.playerName) p.playerName = 'Anonymous';
  return map;
}

const SORTS: Record<PlayerSort, (a: PlayerSummary, b: PlayerSummary) => number> = {
  points: (a, b) => b.totalPoints - a.totalPoints,
  wins: (a, b) => b.wins - a.wins || b.totalPoints - a.totalPoints,
  games: (a, b) => b.games + b.soloGames - (a.games + a.soloGames),
  solveRate: (a, b) => b.solveRate - a.solveRate || b.rounds - a.rounds,
  avgTries: (a, b) => (a.avgTries ?? 99) - (b.avgTries ?? 99),
  recent: (a, b) => b.lastSeen.localeCompare(a.lastSeen),
};

/** Longest run of consecutive solved drills. */
function longestStreak(results: { solved?: boolean | null }[]): number {
  let best = 0;
  let cur = 0;
  for (const r of results) {
    cur = r.solved ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

function parsePage(q: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(q.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(q.pageSize ?? '20'), 10) || 20));
  return { page, pageSize };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Routes ───────────────────────────────────────────────────────────────────

const router = Router();
router.use(requireAdminKey);

router.get('/overview', async (_req, res) => {
  const now = Date.now();
  const since24h = new Date(now - DAY);
  const since7d = new Date(now - 7 * DAY);
  const since30d = new Date(now - 29 * DAY);
  since30d.setUTCHours(0, 0, 0, 0);

  const [
    games, gamesStarted, soloGames, roomsPlaying, roomsInLobby,
    roundAgg, prAgg, variantAgg, dailyGames, dailySolo, mpWords, soloWords, mpFirst, soloFirst,
    mpPlayers, soloPlayers, w24, w7, s24, s7, p24mp, p24solo, p7mp, p7solo,
  ] = await Promise.all([
    GameSession.countDocuments(FINISHED),
    GameSession.countDocuments(),
    SoloResult.countDocuments(),
    Room.countDocuments({ status: { $in: ['playing', 'round-end'] }, updatedAt: { $gte: new Date(now - 2 * 60 * 60 * 1000) } }),
    Room.countDocuments({ status: 'lobby', updatedAt: { $gte: new Date(now - 60 * 60 * 1000) } }),
    GameSession.aggregate<{ rounds: number }>([{ $group: { _id: null, rounds: { $sum: { $size: { $ifNull: ['$rounds', []] } } } } }]),
    GameSession.aggregate<{ n: number; solved: number; triesSum: number; guesses: number; timeSum: number; timeN: number }>([
      ...playerRoundsPipeline(),
      {
        $group: {
          _id: null,
          n: { $sum: 1 },
          solved: { $sum: { $cond: ['$solved', 1, 0] } },
          triesSum: { $sum: { $cond: ['$solved', '$tries', 0] } },
          guesses: { $sum: '$tries' },
          timeSum: { $sum: { $cond: ['$solved', { $ifNull: ['$timeTaken', 0] }, 0] } },
          timeN: { $sum: { $cond: [{ $and: ['$solved', { $ne: ['$timeTaken', null] }] }, 1, 0] } },
        },
      },
    ]),
    GameSession.aggregate<{ _id: Variant | null; n: number }>([{ $group: { _id: '$variant', n: { $sum: 1 } } }]),
    GameSession.aggregate<{ _id: string; n: number }>([
      { $match: { ...FINISHED, createdAt: { $gte: since30d } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
    ]),
    SoloResult.aggregate<{ _id: string; n: number }>([
      { $match: { createdAt: { $gte: since30d } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
    ]),
    GameSession.aggregate<{ _id: string; n: number; solved: number }>([
      ...playerRoundsPipeline(),
      { $group: { _id: '$word', n: { $sum: 1 }, solved: { $sum: { $cond: ['$solved', 1, 0] } } } },
    ]),
    SoloResult.aggregate<{ _id: string; n: number; solved: number }>([
      { $group: { _id: { $toUpper: '$word' }, n: { $sum: 1 }, solved: { $sum: { $cond: ['$solved', 1, 0] } } } },
    ]),
    GameSession.aggregate<{ _id: string; n: number }>([
      ...playerRoundsPipeline(),
      { $match: { firstGuess: { $type: 'string' } } },
      { $group: { _id: '$firstGuess', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 20 },
    ]),
    SoloResult.aggregate<{ _id: string; n: number }>([
      { $project: { first: { $arrayElemAt: ['$guesses.word', 0] } } },
      { $match: { first: { $type: 'string' } } },
      { $group: { _id: '$first', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 20 },
    ]),
    GameSession.distinct('rounds.playerResults.playerId'),
    SoloResult.distinct('playerId'),
    GameSession.countDocuments({ ...FINISHED, createdAt: { $gte: since24h } }),
    GameSession.countDocuments({ ...FINISHED, createdAt: { $gte: since7d } }),
    SoloResult.countDocuments({ createdAt: { $gte: since24h } }),
    SoloResult.countDocuments({ createdAt: { $gte: since7d } }),
    GameSession.distinct('rounds.playerResults.playerId', { createdAt: { $gte: since24h } }),
    SoloResult.distinct('playerId', { createdAt: { $gte: since24h } }),
    GameSession.distinct('rounds.playerResults.playerId', { createdAt: { $gte: since7d } }),
    SoloResult.distinct('playerId', { createdAt: { $gte: since7d } }),
  ]);

  const uniq = (...lists: unknown[][]) => new Set(lists.flat().filter(Boolean)).size;
  const pr = prAgg[0] ?? { n: 0, solved: 0, triesSum: 0, guesses: 0, timeSum: 0, timeN: 0 };

  // Daily series with empty days filled in
  const gamesByDay = new Map(dailyGames.map((d) => [d._id, d.n]));
  const soloByDay = new Map(dailySolo.map((d) => [d._id, d.n]));
  const daily: DailyCount[] = [];
  for (let t = since30d.getTime(); t <= now; t += DAY) {
    const key = dayKey(new Date(t));
    daily.push({ date: key, games: gamesByDay.get(key) ?? 0, solo: soloByDay.get(key) ?? 0 });
  }

  // Word difficulty across multiplayer + solo
  const words = new Map<string, { n: number; solved: number }>();
  for (const w of [...mpWords, ...soloWords]) {
    if (!w._id) continue;
    const cur = words.get(w._id) ?? { n: 0, solved: 0 };
    cur.n += w.n;
    cur.solved += w.solved;
    words.set(w._id, cur);
  }
  const wordStats: WordStat[] = [...words.entries()]
    .filter(([, v]) => v.n >= 3)
    .map(([word, v]) => ({ word, attempts: v.n, solveRate: ratio(v.solved, v.n) }));
  const hardestWords = [...wordStats].sort((a, b) => a.solveRate - b.solveRate || b.attempts - a.attempts).slice(0, 8);
  const easiestWords = [...wordStats].sort((a, b) => b.solveRate - a.solveRate || b.attempts - a.attempts).slice(0, 8);

  const first = new Map<string, number>();
  for (const f of [...mpFirst, ...soloFirst]) first.set(f._id, (first.get(f._id) ?? 0) + f.n);
  const topFirstGuesses = [...first.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count }));

  const variants = { classic: 0, word500: 0 };
  for (const v of variantAgg) variants[v._id === 'word500' ? 'word500' : 'classic'] += v.n;

  return ok<AdminOverview>(res, {
    totals: {
      games,
      gamesStarted,
      rounds: roundAgg[0]?.rounds ?? 0,
      players: uniq(mpPlayers, soloPlayers),
      guesses: pr.guesses,
      soloGames,
    },
    last24h: { games: w24, soloGames: s24, players: uniq(p24mp, p24solo) },
    last7d: { games: w7, soloGames: s7, players: uniq(p7mp, p7solo) },
    live: { roomsPlaying, roomsInLobby },
    solveRate: ratio(pr.solved, pr.n),
    avgTries: avg(pr.triesSum, pr.solved),
    avgSolveTime: avg(pr.timeSum, pr.timeN),
    variants,
    daily,
    hardestWords,
    easiestWords,
    topFirstGuesses,
  });
});

router.get('/games', async (req, res) => {
  const { page, pageSize } = parsePage(req.query);
  const q = String(req.query.q ?? '').trim();
  const filter: Record<string, unknown> = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ roomCode: rx }, { 'rounds.playerResults.playerName': rx }, { 'finalScores.playerName': rx }];
  }
  if (req.query.status === 'finished') Object.assign(filter, FINISHED);
  if (req.query.status === 'abandoned') filter['finalScores.0'] = { $exists: false };

  const [docs, total] = await Promise.all([
    GameSession.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean<LeanSession[]>(),
    GameSession.countDocuments(filter),
  ]);
  return ok<Paged<GameListItem>>(res, { items: docs.map(toGameListItem), page, pageSize, total });
});

router.get('/games/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'Game not found');
  const s = await GameSession.findById(req.params.id).lean<LeanSession>();
  if (!s) return fail(res, 404, 'NOT_FOUND', 'Game not found');
  return ok<GameDetail>(res, {
    ...toGameListItem(s),
    rounds: (s.rounds ?? []).map((r) => ({
      roundNumber: r.roundNumber ?? 0,
      word: r.word ?? '',
      timeLimit: r.timeLimit ?? 0,
      results: (r.playerResults ?? [])
        .map((pr) => ({
          playerId: pr.playerId ?? '',
          playerName: pr.playerName ?? '',
          guesses: cleanGuesses(pr.guesses),
          solved: pr.solved ?? false,
          timeTaken: pr.timeTaken ?? null,
          points: pr.points ?? 0,
        }))
        .sort((a, b) => b.points - a.points),
    })),
  });
});

router.get('/players', async (req, res) => {
  const { page, pageSize } = parsePage(req.query);
  const sort = (String(req.query.sort ?? 'points') as PlayerSort) in SORTS ? (String(req.query.sort ?? 'points') as PlayerSort) : 'points';
  const q = String(req.query.q ?? '').trim().toLowerCase();
  // Players need a few rounds before solve rate / avg tries rankings mean anything
  const minRounds = sort === 'solveRate' || sort === 'avgTries' ? 5 : 0;

  let players = [...(await buildPlayerSummaries()).values()];
  if (q) players = players.filter((p) => p.playerId.toLowerCase().includes(q) || p.names.some((n) => n.toLowerCase().includes(q)));
  if (minRounds) players = players.filter((p) => p.rounds >= minRounds);
  players.sort(SORTS[sort]);

  const items = players.slice((page - 1) * pageSize, page * pageSize).map(({ firstSeen: _f, ...p }: PlayerSummary & { firstSeen?: string }) => p);
  return ok<Paged<PlayerSummary>>(res, { items, page, pageSize, total: players.length });
});

router.get('/players/:playerId', async (req, res) => {
  const playerId = req.params.playerId;
  const summary = (await buildPlayerSummaries(playerId)).get(playerId) as (PlayerSummary & { firstSeen: string }) | undefined;
  if (!summary) return fail(res, 404, 'NOT_FOUND', 'Player not found');

  const [bestGame, fastest, distribution, recentSessions, solo] = await Promise.all([
    GameSession.aggregate<{ best: number }>([
      { $match: { 'finalScores.playerId': playerId } },
      { $unwind: '$finalScores' },
      { $match: { 'finalScores.playerId': playerId } },
      { $group: { _id: null, best: { $max: '$finalScores.totalPoints' } } },
    ]),
    GameSession.aggregate<{ t: number }>([
      ...playerRoundsPipeline({ 'rounds.playerResults.playerId': playerId }),
      { $match: { solved: true, timeTaken: { $ne: null } } },
      { $group: { _id: null, t: { $min: '$timeTaken' } } },
    ]),
    GameSession.aggregate<{ _id: number; n: number }>([
      ...playerRoundsPipeline({ 'rounds.playerResults.playerId': playerId }),
      { $match: { solved: true } },
      { $group: { _id: '$tries', n: { $sum: 1 } } },
    ]),
    GameSession.find({ 'rounds.playerResults.playerId': playerId }).sort({ createdAt: -1 }).limit(20).lean<LeanSession[]>(),
    SoloResult.find({ playerId }).sort({ createdAt: 1 }).lean(),
  ]);

  const guessDistribution = Array(8).fill(0) as number[];
  for (const d of distribution) if (d._id >= 1 && d._id <= 8) guessDistribution[d._id - 1] += d.n;
  for (const s of solo) if (s.solved && s.tries && s.tries <= 8) guessDistribution[s.tries - 1] += 1;

  const recentGames = recentSessions.map((s) => {
    const item = toGameListItem(s);
    const idx = item.players.findIndex((p) => p.playerId === playerId);
    return { ...item, rank: idx + 1, points: item.players[idx]?.totalPoints ?? 0 };
  });

  return ok<PlayerDetail>(res, {
    ...summary,
    bestGameScore: bestGame[0]?.best ?? 0,
    fastestSolve: fastest[0]?.t ?? null,
    guessDistribution,
    bestSoloStreak: longestStreak(solo),
    recentGames,
    recentSolo: solo.slice(-20).reverse().map((s) => ({
      createdAt: (s.createdAt as Date).toISOString(),
      variant: (s.variant as Variant) ?? 'classic',
      hardMode: s.hardMode ?? false,
      word: s.word ?? '',
      solved: s.solved ?? false,
      tries: s.tries ?? 0,
      durationSec: s.durationMs != null ? Math.round(s.durationMs / 1000) : null,
    })),
  });
});

router.get('/records', async (_req, res) => {
  const [bestGame, bestRound, fastest, firstTry, biggestGame, fastestSolo, soloAll, players] = await Promise.all([
    GameSession.aggregate<{ _id: mongoose.Types.ObjectId; createdAt: Date; fs: { playerId: string; playerName: string; totalPoints: number } }>([
      { $match: FINISHED },
      { $unwind: '$finalScores' },
      { $sort: { 'finalScores.totalPoints': -1, createdAt: 1 } },
      { $limit: 1 },
      { $project: { createdAt: 1, fs: '$finalScores' } },
    ]),
    GameSession.aggregate<{ _id: mongoose.Types.ObjectId; createdAt: Date; playerId: string; playerName: string; points: number; word: string }>([
      ...playerRoundsPipeline(),
      { $sort: { points: -1, createdAt: 1 } },
      { $limit: 1 },
    ]),
    GameSession.aggregate<{ _id: mongoose.Types.ObjectId; createdAt: Date; playerId: string; playerName: string; timeTaken: number; word: string; tries: number }>([
      ...playerRoundsPipeline(),
      { $match: { solved: true, timeTaken: { $ne: null } } },
      { $sort: { timeTaken: 1, createdAt: 1 } },
      { $limit: 1 },
    ]),
    GameSession.aggregate<{ _id: string; n: number; name: string }>([
      ...playerRoundsPipeline(),
      { $match: { solved: true, tries: 1 } },
      { $group: { _id: '$playerId', n: { $sum: 1 }, name: { $last: '$playerName' } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]),
    GameSession.aggregate<{ _id: mongoose.Types.ObjectId; createdAt: Date; roomCode: string; n: number }>([
      { $match: FINISHED },
      { $project: { createdAt: 1, roomCode: 1, n: { $size: '$finalScores' } } },
      { $sort: { n: -1, createdAt: 1 } },
      { $limit: 1 },
    ]),
    SoloResult.find({ solved: true, durationMs: { $gt: 0 } }).sort({ durationMs: 1 }).limit(1).lean(),
    SoloResult.find({ playerId: { $type: 'string' } }, { playerId: 1, playerName: 1, solved: 1 }).sort({ createdAt: 1 }).lean(),
    buildPlayerSummaries(),
  ]);

  const records: RecordEntry[] = [];
  const date = (d: Date) => d.toISOString();
  const all = [...players.values()];
  const leader = (score: (p: PlayerSummary) => number, filter: (p: PlayerSummary) => boolean = () => true) =>
    all.filter(filter).sort((a, b) => score(b) - score(a))[0];

  if (bestGame[0]) {
    const g = bestGame[0];
    records.push({ label: 'Highest game score', value: `${g.fs.totalPoints} pts`, playerId: g.fs.playerId, playerName: g.fs.playerName, gameId: g._id.toString(), date: date(g.createdAt) });
  }
  if (bestRound[0]) {
    const r = bestRound[0];
    records.push({ label: 'Highest round score', value: `${r.points} pts`, playerId: r.playerId, playerName: r.playerName, gameId: r._id.toString(), detail: r.word, date: date(r.createdAt) });
  }
  if (fastest[0]) {
    const r = fastest[0];
    records.push({ label: 'Fastest multiplayer solve', value: `${r.timeTaken}s`, playerId: r.playerId, playerName: r.playerName, gameId: r._id.toString(), detail: `${r.word} in ${r.tries} ${r.tries === 1 ? 'try' : 'tries'}`, date: date(r.createdAt) });
  }
  if (fastestSolo[0]) {
    const s = fastestSolo[0];
    records.push({ label: 'Fastest solo solve', value: `${Math.round((s.durationMs ?? 0) / 1000)}s`, playerId: s.playerId ?? undefined, playerName: s.playerName ?? 'Anonymous', detail: `${s.word?.toUpperCase()} in ${s.tries} ${s.tries === 1 ? 'try' : 'tries'}`, date: date(s.createdAt as Date) });
  }
  if (firstTry[0]) {
    records.push({ label: 'Most first-try solves', value: String(firstTry[0].n), playerId: firstTry[0]._id, playerName: firstTry[0].name });
  }

  const mostWins = leader((p) => p.wins, (p) => p.wins > 0);
  if (mostWins) records.push({ label: 'Most wins', value: String(mostWins.wins), playerId: mostWins.playerId, playerName: mostWins.playerName });
  const mostPoints = leader((p) => p.totalPoints, (p) => p.totalPoints > 0);
  if (mostPoints) records.push({ label: 'Most career points', value: `${mostPoints.totalPoints} pts`, playerId: mostPoints.playerId, playerName: mostPoints.playerName });
  const mostGames = leader((p) => p.games + p.soloGames, (p) => p.games + p.soloGames > 0);
  if (mostGames) records.push({ label: 'Most games played', value: String(mostGames.games + mostGames.soloGames), playerId: mostGames.playerId, playerName: mostGames.playerName, detail: `${mostGames.games} multiplayer · ${mostGames.soloGames} solo` });
  const bestRate = leader((p) => p.solveRate, (p) => p.rounds >= 10);
  if (bestRate) records.push({ label: 'Best solve rate (10+ rounds)', value: `${Math.round(bestRate.solveRate * 100)}%`, playerId: bestRate.playerId, playerName: bestRate.playerName, detail: `${bestRate.solved}/${bestRate.rounds} rounds` });
  const fewestTries = all.filter((p) => p.solved >= 10 && p.avgTries != null).sort((a, b) => a.avgTries! - b.avgTries!)[0];
  if (fewestTries) records.push({ label: 'Fewest average tries (10+ solves)', value: String(fewestTries.avgTries), playerId: fewestTries.playerId, playerName: fewestTries.playerName });

  // Longest solo win streak
  const byPlayer = new Map<string, { name: string; results: { solved?: boolean | null }[] }>();
  for (const s of soloAll) {
    const id = s.playerId as string;
    const cur = byPlayer.get(id) ?? { name: s.playerName ?? 'Anonymous', results: [] };
    cur.results.push(s);
    if (s.playerName) cur.name = s.playerName;
    byPlayer.set(id, cur);
  }
  let streak = { id: '', name: '', n: 0 };
  for (const [id, v] of byPlayer) {
    const n = longestStreak(v.results);
    if (n > streak.n) streak = { id, name: v.name, n };
  }
  if (streak.n > 0) records.push({ label: 'Longest solo streak', value: String(streak.n), playerId: streak.id, playerName: streak.name });

  if (biggestGame[0]) {
    const g = biggestGame[0];
    records.push({ label: 'Biggest game', value: `${g.n} players`, gameId: g._id.toString(), detail: `Room ${g.roomCode}`, date: date(g.createdAt) });
  }

  return ok<AdminRecords>(res, { records });
});

export default router;
