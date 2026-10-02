import 'dotenv/config';
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'attendx-gateway',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 300,
    retries: 25
  }
});

let _producer = null;

export async function getProducer() {
  if (_producer) return _producer;
  _producer = kafka.producer();
  await _producer.connect();
  console.log('Kafka producer connected');
  return _producer;
}

// Publish a single message with JSON payload (C3: never image bytes)
export async function publish(topic, value) {
  const producer = await getProducer();
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(value) }],
  });
}

export { kafka };
