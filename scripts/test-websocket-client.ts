/**
 * Test script to connect to WebSocket and listen for position updates
 *
 * Usage:
 *   bun run scripts/test-websocket-client.ts
 *   # or
 *   npx ts-node scripts/test-websocket-client.ts
 */

import { io, type Socket } from 'socket.io-client';

// Configuration
const WS_URL = process.env.WS_URL || 'http://localhost:3000';
const NAMESPACE = '/tracking';
const RACE_ID = process.env.RACE_ID || 'R2025-07';

interface PositionUpdate {
  participantId: string;
  raceId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  status: string;
}

interface BatchPositionUpdate {
  raceId: string;
  positions: Array<{
    participantId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    status: string;
  }>;
}

interface SubscribeResponse {
  success: boolean;
  message: string;
  raceId?: string;
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString();
}

async function main() {
  console.log(`🔗 Connecting to WebSocket at ${WS_URL}${NAMESPACE}...`);

  const socket: Socket = io(`${WS_URL}${NAMESPACE}`, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server');
    console.log(`   Socket ID: ${socket.id}\n`);

    // Subscribe to race updates
    console.log(`📥 Subscribing to race: ${RACE_ID}...`);
    socket.emit('subscribe_race', { raceId: RACE_ID });
  });

  socket.on('subscribe_race_response', (response: SubscribeResponse) => {
    if (response.success) {
      console.log(`✅ ${response.message}\n`);
      console.log('👂 Listening for position updates...');
      console.log('   Press Ctrl+C to stop\n');
    } else {
      console.error(`❌ Failed to subscribe: ${response.message}`);
    }
  });

  socket.on('position_update', (data: PositionUpdate) => {
    console.log(`📍 [${formatTimestamp(data.timestamp)}] ${data.participantId}`);
    console.log(`   Location: (${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)})`);
    console.log(`   Status: ${data.status}`);
    console.log('');
  });

  socket.on('batch_position_update', (data: BatchPositionUpdate) => {
    console.log(`📦 Batch update for race ${data.raceId} (${data.positions.length} positions):`);
    for (const pos of data.positions) {
      console.log(`   📍 ${pos.participantId}: (${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}) - ${pos.status}`);
    }
    console.log('');
  });

  socket.on('disconnect', (reason) => {
    console.log(`⚠️  Disconnected: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`🔄 Reconnection attempt #${attemptNumber}...`);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ Failed to reconnect after all attempts');
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping...');

    // Unsubscribe before disconnecting
    socket.emit('unsubscribe_race', { raceId: RACE_ID });

    setTimeout(() => {
      socket.disconnect();
      console.log('👋 Disconnected from WebSocket server');
      process.exit(0);
    }, 500);
  });
}

main().catch(console.error);
