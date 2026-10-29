from contextlib import asynccontextmanager
from io import BytesIO
from threading import Lock
import warnings

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from sentence_transformers import SentenceTransformer


MODEL_NAME = "sentence-transformers/clip-ViT-B-32"
MAX_SIZE = 5 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000
model_lock = Lock()


@asynccontextmanager
async def lifespan(app):
    app.state.model = SentenceTransformer(MODEL_NAME, device="cpu")
    yield
    app.state.model = None


app = FastAPI(title="Eco Marc Visual Search", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "dimensions": 512}


@app.post("/embed")
def embed_image(image: UploadFile = File(...)):
    try:
        if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(400, "Use a JPG, PNG or WebP image.")

        data = image.file.read(MAX_SIZE + 1)
        if len(data) > MAX_SIZE:
            raise HTTPException(413, "The image must be 5 MB or smaller.")

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(data)) as source:
                    if source.format not in {"JPEG", "PNG", "WEBP"}:
                        raise ValueError("Unsupported image format")
                    if source.width * source.height > Image.MAX_IMAGE_PIXELS:
                        raise ValueError("Image dimensions too large")
                    source.verify()
                with Image.open(BytesIO(data)) as source:
                    picture = ImageOps.exif_transpose(source).convert("RGB")
                    picture.load()
        except (UnidentifiedImageError, OSError, ValueError,
                Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise HTTPException(400, "The image is invalid or its dimensions are too large.")

        try:
            with model_lock:
                vector = app.state.model.encode(picture, normalize_embeddings=True)
        finally:
            picture.close()

        return {
            "model": MODEL_NAME,
            "dimensions": len(vector),
            "embedding": vector.tolist()
        }
    finally:
        image.file.close()
