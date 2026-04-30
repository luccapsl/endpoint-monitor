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
    import asyncio
    import logging

    # Capture the running event loop so the scheduler can be started later
    # from sync route handlers (e.g. setup wizard) that run in a thread pool.
    sched.set_app_event_loop(asyncio.get_running_loop())

    initialized = False
    if config_exists():
        try:
            config = load_config()
            init_engine(config)
            init_db()
            sched.init_scheduler(app)  # also starts retention job
            initialized = True
        except Exception as exc:
            logging.getLogger("app").error("DB init failed on startup: %s", exc)
    yield
    if initialized:
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
