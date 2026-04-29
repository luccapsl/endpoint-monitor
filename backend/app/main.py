from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import config_exists, load_config
from app.database import init_db, init_engine
import app.models  # noqa: F401 — registers models with Base before any create_all
from app.routers import setup


@asynccontextmanager
async def lifespan(app: FastAPI):
    if config_exists():
        config = load_config()
        init_engine(config)
        init_db()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(setup.router, prefix="/api")
