"""DLQ Retry Worker — consumes attendx.face-match-dlq.v1 with resilient reconnect.

Run: python dlq_retry_worker.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import json
import time
import warnings

warnings.filterwarnings('ignore', category=DeprecationWarning, module='kafka')

import config
from kafka import KafkaConsumer, KafkaProducer


def make_consumer():
    return KafkaConsumer(
        'attendx.face-match-dlq.v1',
        bootstrap_servers=config.KAFKA_BROKERS,
        group_id='attendx-dlq-retry-group',
        auto_offset_reset='latest',
        enable_auto_commit=True,
        consumer_timeout_ms=5000,
    )


def make_producer():
    return KafkaProducer(bootstrap_servers=config.KAFKA_BROKERS)


def main():
    brokers = ', '.join(config.KAFKA_BROKERS)
    print(f'[DLQ] Starting — Kafka brokers: {brokers}')
    attempt = 0

    while True:
        consumer = None
        producer = None
        try:
            print(f'[DLQ] Connecting to Kafka... (attempt {attempt + 1})')
            consumer = make_consumer()
            producer = make_producer()
            print('[DLQ] Connected ✓  Listening on attendx.face-match-dlq.v1')
            attempt = 0

            for msg in consumer:
                if msg is None:
                    continue
                try:
                    payload = json.loads(msg.value.decode('utf-8'))
                except Exception as exc:
                    print(f'[DLQ] Failed to decode message: {exc}')
                    continue

                retry_at = payload.get('nextRetryAt', 0)
                dlq_attempt = payload.get('attempt', 1)
                now = time.time()

                if retry_at > now:
                    sleep_sec = retry_at - now
                    print(f'[DLQ] Waiting {sleep_sec:.1f}s before retry attempt {dlq_attempt}...')
                    time.sleep(sleep_sec)

                if dlq_attempt >= config.MAX_DLQ_ATTEMPTS:
                    print(f"[DLQ] Max attempts reached for {payload.get('cropCloudinaryId')} — routing to needs-review")
                    out = {**payload, 'forceNeedsReview': True}
                    producer.send('attendx.face-crop.v1', json.dumps(out).encode('utf-8'))
                else:
                    print(f"[DLQ] Replaying attempt {dlq_attempt} for {payload.get('cropCloudinaryId')}")
                    clean = {k: v for k, v in payload.items() if k != 'nextRetryAt'}
                    producer.send('attendx.face-crop.v1', json.dumps(clean).encode('utf-8'))

                producer.flush()

        except KeyboardInterrupt:
            print('[DLQ] Shutting down...')
            break
        except Exception as exc:
            attempt += 1
            backoff = min(5 * attempt, 60)
            print(f'[DLQ] Kafka error: {exc}')
            print(f'[DLQ] Reconnecting in {backoff}s...')
            time.sleep(backoff)
        finally:
            if producer:
                try: producer.close(timeout=2)
                except: pass
            if consumer:
                try: consumer.close()
                except: pass


if __name__ == '__main__':
    main()