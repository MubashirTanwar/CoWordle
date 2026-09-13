# CoWordle — Multiplayer Wordle

Real-time multiplayer Wordle. Same word for everyone, compete on speed and accuracy.
Play **Classic** or **Word500**, or practise alone in **Solo Drill**.

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`) or a MongoDB Atlas URI

### 1. Install dependencies

```bash
# Frontend (Next.js)
npm install

# Backend (Express)
cd server && npm install
```

### 2. Configure environment

```bash
# Root .env.local
# Socket.io connects here directly; REST calls go through the Next.js /api/* rewrite to it
NEXT_PUBLIC_SERVER_URL=http://localhost:3001

# Server — copy and edit
cp server/.env.example server/.env
# Edit MONGODB_URI if not using local MongoDB
```

### 3. Run

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev       # tsx watch
# production: npm run build && npm start
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Health check

The backend exposes `GET /health` (and `GET /api/health`). It returns `503` until MongoDB is connected.
The frontend shows a loading screen until it gets a healthy response. Hosts that sleep when idle can
take a while to wake up, so the loading screen stays up until then. While a tab is open, the
frontend pings the endpoint every 5 minutes and again every time the home page loads.

## How to Play

1. Enter your name and click **Create Room** or **Join Room**
2. Share the 6-character room code with friends
3. Host sets **time per round** and **number of rounds**, then clicks **Start Game**
4. All players get the **same 5-letter word** — guess it Wordle-style (6 attempts max)
5. 🟩 Green = right letter, right spot • 🟨 Yellow = right letter, wrong spot • ⬛ Gray = not in word
6. When someone finishes, everyone gets notified (but can't see their guesses)
7. Round ends when everyone finishes **or** the timer runs out
8. Final scores shown after all rounds

## Modes

- **Classic**: normal Wordle feedback, 6 tries. Optional **Hard Mode**: revealed hints must be reused.
- **Word500**: each guess only tells you *how many* letters are 🟩 right spot, 🟨 wrong spot or 🟥 not in the word, not which ones. You get 8 tries. Tap letters on the board to keep your own notes.
- **Solo Drill**: endless practice on your own in either mode. Tracks played, win %, streak and average tries.

## Scoring

| Component | Points |
|-----------|--------|
| Base (solved) | 100 |
| Time bonus | 0–50 (faster = more) |
| Tries bonus | 0–50 (fewer tries = more) |
| **Max per round** | **200** |
| DNF | 0 |

## Tech Stack

- **Language**: TypeScript throughout. Socket events are typed end to end in `server/src/shared/events.ts`, and client payloads are validated with Zod.
- **Frontend**: Next.js 14, Tailwind CSS, TanStack Query, Socket.io-client
- **Backend**: Express.js, Socket.io
- **Database**: MongoDB + Mongoose
