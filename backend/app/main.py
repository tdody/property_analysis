from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.models import Property, MortgageScenario, STRAssumptions, LTRAssumptions  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="STR Profitability Calculator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from app.routers import properties, scenarios, assumptions, compute, ltr_assumptions, settings, quick_test

app.include_router(properties.router)
app.include_router(scenarios.router)
app.include_router(assumptions.router)
app.include_router(compute.router)
app.include_router(ltr_assumptions.router)
app.include_router(settings.router)
app.include_router(quick_test.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
