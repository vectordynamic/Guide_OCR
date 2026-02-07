"""
Smart Textbook Digitization Engine - FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.routes import books, chapters, ocr_pages, questions

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Events
@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

# Routes
app.include_router(books.router, prefix=f"{settings.API_V1_STR}/books", tags=["books"])
app.include_router(chapters.router, prefix=f"{settings.API_V1_STR}/chapters", tags=["chapters"])
app.include_router(ocr_pages.router, prefix=f"{settings.API_V1_STR}/ocr-pages", tags=["ocr-pages"])
app.include_router(questions.router, prefix=f"{settings.API_V1_STR}/questions", tags=["questions"])

@app.get("/")
async def root():
    return {"message": "Smart Textbook Digitization Engine API", "docs": "/docs"}
