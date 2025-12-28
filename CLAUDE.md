# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Peril** - A multiplayer strategy game demonstrating pub/sub patterns using RabbitMQ and TypeScript. Part of Boot.dev's Learn Pub/Sub course.

## Commands

### RabbitMQ Management
```bash
npm run rabbit:start  # Start/create RabbitMQ container (peril_rabbitmq)
npm run rabbit:stop   # Stop RabbitMQ container
npm run rabbit:logs   # Follow RabbitMQ logs
```

RabbitMQ runs in Docker on ports 5672 (AMQP) and 15672 (management UI).

### Running the Application
```bash
npm run server  # Start game server (tsx src/server/index.ts)
npm run client  # Start game client (tsx src/client/index.ts)
npm run build   # TypeScript compilation check
```

Multiple clients can connect simultaneously to the same server.

## Architecture

### Message Flow Pattern

This application implements RabbitMQ pub/sub with **two exchange types**:

1. **ExchangePerilDirect** (`peril_direct`) - Direct routing for server-to-all-clients broadcast
   - `pause` routing key: Server broadcasts game pause/resume state to all clients

2. **ExchangePerilTopic** (`peril_topic`) - Topic-based routing for player-specific and game-wide messages
   - `army_moves.{username}`: Player-specific army movements
   - `war.{username}`: War declarations between players
   - `game_logs.*`: Durable game event logs

3. **ExchangeDeadLetter** (`peril_dlx`) - Dead letter exchange for failed message handling

### Queue Types

- **Transient queues**: Auto-delete, exclusive, non-durable (client pause/move queues)
- **Durable queues**: Persist across restarts (game logs)

All queues route failed messages to the dead letter exchange via `x-dead-letter-exchange` argument.

### Client-Server Interaction

**Server** (`src/server/index.ts`):
- Manages global game state (pause/resume)
- Uses `ConfirmChannel` for reliable publishing
- Broadcasts pause state via `ExchangePerilDirect`
- Does NOT process army movements or wars (clients handle peer-to-peer via subscriptions)

**Client** (`src/client/index.ts`):
- Maintains local `GameState` for the player
- Subscribes to:
  - Pause state updates from server (direct exchange)
  - Army movements from all players (topic exchange, `army_moves.*`)
  - War recognitions (topic exchange, `war.*`)
- Publishes army movements that other clients detect and process
- Handles war resolution locally via `handlerWar`

### Message Handlers and ACK Strategy

Message handlers in `src/internal/pubsub/sub.ts` return `AckType`:
- `"ack"`: Message processed successfully
- `"nack_requeue"`: Temporary failure, requeue for retry (e.g., war detected, needs confirmation)
- `"nack_discard"`: Permanent failure, discard message (e.g., same player conflict)

**Critical Flow - Move to War**:
1. Player publishes army move via `publishJSON` (uses `ConfirmChannel`)
2. All clients receive move via `handlerMove`
3. If units overlap → `MoveOutcome.MakeWar` → handler returns `"nack_requeue"` AND publishes `RecognitionOfWar`
4. War message processed by `handlerWar` which resolves combat and acknowledges

### TypeScript Module Configuration

- ES modules (`"type": "module"` in package.json)
- Node16+ module resolution (`"module": "nodenext"`)
- All imports MUST include `.js` extension (even for `.ts` files) due to `verbatimModuleSyntax`
- Example: `import { GameState } from "./gamestate.js"`

### Game Logic

**Unit System** (`src/internal/gamelogic/gamedata.ts`):
- Ranks: `infantry` (1 power), `cavalry` (5 power), `artillery` (10 power)
- Locations: `americas`, `europe`, `africa`, `asia`, `australia`, `antarctica`

**Combat Resolution** (`src/internal/gamelogic/war.ts`):
- Wars triggered when players have units in same location
- Power calculated by summing unit power levels
- Losing player's units in conflict location are removed
- Draw results in both players losing units

**State Management** (`src/internal/gamelogic/gamestate.ts`):
- `GameState` class manages player's units and pause state
- `getPlayerSnap()` returns immutable snapshot for message publishing
- Units stored in `Record<number, Unit>` keyed by unit ID

## Key Implementation Details

### Publishing Patterns
- Always use `ConfirmChannel` for publishing (reliability guarantee)
- `publishJSON<T>` serializes to JSON with `application/json` content type
- Routing keys follow pattern: `{prefix}.{username}` for player-specific messages

### Subscription Patterns
- `subscribeJSON<T>` handles declare, bind, consume, deserialize, and ack/nack
- Handlers are closures capturing `GameState` reference for mutation
- `declareAndBind` returns `[Channel, AssertQueue]` tuple

### Error Handling
- Message handlers determine success/failure via return type, not exceptions
- Failed messages go to dead letter exchange for inspection/recovery
- Client disconnection automatically cleans up transient queues
