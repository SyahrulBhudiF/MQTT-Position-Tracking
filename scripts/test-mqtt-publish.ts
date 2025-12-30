/**
 * Test script to simulate GPS data publishing via MQTT
 *
 * Usage:
 *   bun run scripts/test-mqtt-publish.ts
 *   # or
 *   npx ts-node scripts/test-mqtt-publish.ts
 */

import mqtt from 'mqtt';

// Configuration
const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const TOPIC_PREFIX = 'tracking';

// Sample participants
const participants = [
  { id: 'P001', name: 'Participant 1' },
  { id: 'P002', name: 'Participant 2' },
  { id: 'P003', name: 'Participant 3' },
];

// Sample race
const raceId = 'R2025-07';

// Starting coordinates (Malang, Indonesia)
const startLat = -7.9456;
const startLng = 112.6145;

// Status options
const statuses = ['moving', 'stopped', 'moving', 'moving'] as const;

interface PositionPayload {
  participant_id: string;
  race_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  status: string;
}

function randomOffset(): number {
  return (Math.random() - 0.5) * 0.001; // Small random offset
}

function getRandomStatus(): string {
  return statuses[Math.floor(Math.random() * statuses.length)];
}

function generatePayload(participantId: string, index: number): PositionPayload {
  return {
    participant_id: participantId,
    race_id: raceId,
    latitude: startLat + randomOffset() + index * 0.0001,
    longitude: startLng + randomOffset() + index * 0.0001,
    timestamp: new Date().toISOString(),
    status: getRandomStatus(),
  };
}

async function main() {
  console.log(`🔗 Connecting to MQTT broker at ${BROKER_URL}...`);

  const client = mqtt.connect(BROKER_URL, {
    clientId: `test-publisher-${Date.now()}`,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 1000,
  });

  client.on('connect', () => {
    console.log('✅ Connected to MQTT broker\n');
    console.log('📡 Publishing GPS updates every 2 seconds...');
    console.log('   Press Ctrl+C to stop\n');

    let messageCount = 0;

    // Publish messages for each participant every 2 seconds
    const interval = setInterval(() => {
      for (const participant of participants) {
        const topic = `${TOPIC_PREFIX}/${participant.id}/position`;
        const payload = generatePayload(participant.id, messageCount);

        client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
          if (err) {
            console.error(`❌ Error publishing to ${topic}:`, err);
          } else {
            console.log(`📤 [${participant.id}] lat: ${payload.latitude.toFixed(6)}, lng: ${payload.longitude.toFixed(6)}, status: ${payload.status}`);
          }
        });
      }

      messageCount++;
      console.log(`   --- Message batch #${messageCount} sent ---\n`);
    }, 2000);

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping...');
      clearInterval(interval);
      client.end(true, () => {
        console.log('👋 Disconnected from MQTT broker');
        process.exit(0);
      });
    });
  });

  client.on('error', (err) => {
    console.error('❌ MQTT Error:', err);
    process.exit(1);
  });

  client.on('offline', () => {
    console.log('⚠️  MQTT client went offline');
  });

  client.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
  });
}

main().catch(console.error);
