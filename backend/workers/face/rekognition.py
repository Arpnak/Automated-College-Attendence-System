"""AWS Rekognition face operations — used when USE_AWS=True."""
import boto3
import config


_client = None

def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            'rekognition',
            aws_access_key_id=config.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=config.AWS_SECRET_ACCESS_KEY,
            region_name=config.AWS_REGION,
        )
    return _client


def index_face(image_bytes: bytes, student_id: str, collection_id: str) -> dict:
    """Index a student's face into their course Rekognition collection."""
    client = _get_client()
    # Ensure collection exists
    try:
        client.create_collection(CollectionId=collection_id)
    except client.exceptions.ResourceAlreadyExistsException:
        pass

    resp = client.index_faces(
        CollectionId=collection_id,
        Image={'Bytes': image_bytes},
        ExternalImageId=student_id,
        DetectionAttributes=[],
    )
    faces = resp.get('FaceRecords', [])
    if not faces:
        return {'face_indexed': False}
    return {'face_indexed': True, 'face_id': faces[0]['Face']['FaceId']}


def search_face(image_bytes: bytes, collection_id: str) -> dict:
    """Search for a face in a Rekognition collection.
    
    Returns:
        {'matched': bool, 'student_id': str|None, 'confidence': float,
         'candidates': [{'student_id': str, 'confidence': float}]}
    """
    client = _get_client()
    try:
        resp = client.search_faces_by_image(
            CollectionId=collection_id,
            Image={'Bytes': image_bytes},
            FaceMatchThreshold=0,       # Return all candidates; we threshold locally
            MaxFaces=5,
        )
    except client.exceptions.InvalidParameterException:
        # No face detected in the image
        return {'matched': False, 'student_id': None, 'confidence': 0.0, 'candidates': []}
    except client.exceptions.ProvisionedThroughputExceededException:
        raise  # Caller handles DLQ routing

    candidates = [
        {'student_id': m['Face']['ExternalImageId'], 'confidence': m['Similarity']}
        for m in resp.get('FaceMatches', [])
    ]
    if not candidates:
        return {'matched': False, 'student_id': None, 'confidence': 0.0, 'candidates': []}

    best = candidates[0]
    return {
        'matched': best['confidence'] >= config.CONFIDENCE_THRESHOLD,
        'student_id': best['student_id'],
        'confidence': best['confidence'],
        'candidates': candidates,
    }
