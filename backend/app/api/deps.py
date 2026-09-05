from app.db.session import get_db

# Single-user app: no authentication / permission matrix needed yet. This
# module exists to mirror ReplyPilot's dependency structure so future auth can
# slot in here (a JWT dependency would live alongside get_db and every route
# would add `Authorized = Depends(require_auth)`).
__all__ = ["get_db"]
