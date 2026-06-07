"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1 import assessment_settings, auth, form_settings, locations, project_types, projects, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(locations.router, prefix="/locations", tags=["locations"])
api_router.include_router(project_types.router, prefix="/settings/project-types", tags=["project-types"])
api_router.include_router(form_settings.router, prefix="/settings/forms", tags=["form-settings"])
api_router.include_router(
    assessment_settings.router, prefix="/settings/assessment", tags=["assessment-settings"]
)
