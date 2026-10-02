"""Shared configuration for all Python workers."""
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

KAFKA_BROKERS = os.getenv('KAFKA_BROKERS', 'localhost:9092').split(',')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://attendx:attendx@localhost:5432/attendx')

CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', '')
CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY', '')
CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET', '')

AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
AWS_REKOGNITION_COLLECTION_PREFIX = os.getenv('AWS_REKOGNITION_COLLECTION_PREFIX', 'attendx-')

CONFIDENCE_THRESHOLD = float(os.getenv('REKOGNITION_CONFIDENCE_THRESHOLD', '80'))
RATE_PER_SEC = int(os.getenv('REKOGNITION_RATE_PER_SEC', '10'))
MAX_DLQ_ATTEMPTS = int(os.getenv('MAX_DLQ_ATTEMPTS', '5'))

# True when both AWS creds are present — switches face module to Rekognition mode
USE_AWS = bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)
