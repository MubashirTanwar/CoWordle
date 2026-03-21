# CoWordle — Multiplayer Wordle

Real-time multiplayer Wordle. Same word for everyone, compete on speed and accuracy.

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
# Root .env.local (already created)
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
npm start         # or: npm run dev (with nodemon)
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## How to Play

1. Enter your name and click **Create Room** or **Join Room**
2. Share the 6-character room code with friends
3. Host sets **time per round** and **number of rounds**, then clicks **Start Game**
4. All players get the **same 5-letter word** — guess it Wordle-style (6 attempts max)
5. 🟩 Green = right letter, right spot • 🟨 Yellow = right letter, wrong spot • ⬛ Gray = not in word
6. When someone finishes, everyone gets notified (but can't see their guesses)
7. Round ends when everyone finishes **or** the timer runs out
8. Final scores shown after all rounds

## Scoring

| Component | Points |
|-----------|--------|
| Base (solved) | 100 |
| Time bonus | 0–50 (faster = more) |
| Tries bonus | (6 − tries) × 10 (max 50) |
| **Max per round** | **200** |
| DNF | 0 |

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, Socket.io-client
- **Backend**: Express.js, Socket.io
- **Database**: MongoDB + Mongoose
