"""Face matcher dispatcher — selects AWS Rekognition or local DeepFace based on env vars.

Usage:
    from face.matcher import index_face, search_face

Both functions have identical signatures regardless of backend.
"""
import config

if config.USE_AWS:
    from face.rekognition import index_face, search_face
    print("[face/matcher] Using AWS Rekognition backend")
else:
    from face.local_matcher import index_face, search_face
    print("[face/matcher] Using local DeepFace backend")
