from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import config_exists, load_config
from app.database import init_db, init_engine
import app.models  # noqa: F401 — registers models with Base before any create_all
from app.routers import setup
from app.routers import endpoints as endpoints_router
from app.routers import websocket as websocket_router
from app import scheduler as sched


@asynccontextmanager
async def lifespan(app: FastAPI):
    configured = config_exists()
    if configured:
        config = load_config()
        init_engine(config)
        init_db()
        sched.init_scheduler(app)
    yield
    if configured:
        sched.scheduler.shutdown(wait=False)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(setup.router, prefix="/api")
app.include_router(endpoints_router.router, prefix="/api")
app.include_router(websocket_router.router)
