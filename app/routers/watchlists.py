from datetime import datetime, timezone
from typing import List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.database import get_database
from app.models.watchlist import WatchlistCreate, WatchlistResponse
from app.services.audit_service import log_user_action

router = APIRouter(prefix="/watchlists", tags=["Watchlists"])

@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED, summary="Create Watchlist")
async def create_watchlist(
    wl_data: WatchlistCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new watchlist for the user.
    """
    db = get_database()
    user_id = str(current_user["_id"])

    doc = {
        "user_id": user_id,
        "name": wl_data.name.strip(),
        "creation_date": datetime.now(timezone.utc),
        "items": []
    }
    result = await db.watchlists.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    await log_user_action(user_id, f"CREATED_WATCHLIST:{doc['_id']}")
    return doc

@router.get("", response_model=List[WatchlistResponse], summary="List User Watchlists")
async def list_watchlists(current_user: dict = Depends(get_current_user)):
    """
    List all watchlists belonging to the current user.
    """
    db = get_database()
    user_id = str(current_user["_id"])

    cursor = db.watchlists.find({"user_id": user_id}).sort("creation_date", -1)
    lists = await cursor.to_list(length=50)
    for w in lists:
        w["_id"] = str(w["_id"])
        for it in w.get("items", []):
            it["_id"] = str(it.get("_id", ""))
    return lists

@router.post("/{watchlist_id}/items", response_model=WatchlistResponse, summary="Add Item to Watchlist")
async def add_watchlist_item(
    watchlist_id: str,
    symbol: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a tracked asset symbol to a watchlist.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    try:
        obj_id = ObjectId(watchlist_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid watchlist_id")

    item = {
        "_id": str(ObjectId()),
        "symbol": symbol.strip().upper(),
        "added_at": datetime.now(timezone.utc)
    }

    updated = await db.watchlists.find_one_and_update(
        {"_id": obj_id, "user_id": user_id},
        {"$push": {"items": item}},
        return_document=True
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Watchlist not found or access denied")

    updated["_id"] = str(updated["_id"])
    for it in updated.get("items", []):
        it["_id"] = str(it.get("_id", ""))
    return updated

@router.delete("/{watchlist_id}/items/{item_id}", response_model=WatchlistResponse, summary="Remove Item from Watchlist")
async def remove_watchlist_item(
    watchlist_id: str,
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Remove an item from a watchlist.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    try:
        obj_id = ObjectId(watchlist_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid watchlist_id")

    updated = await db.watchlists.find_one_and_update(
        {"_id": obj_id, "user_id": user_id},
        {"$pull": {"items": {"_id": item_id}}},
        return_document=True
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Watchlist or item not found")

    updated["_id"] = str(updated["_id"])
    for it in updated.get("items", []):
        it["_id"] = str(it.get("_id", ""))
    return updated

@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Watchlist")
async def delete_watchlist(
    watchlist_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete an entire watchlist.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    try:
        obj_id = ObjectId(watchlist_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid watchlist_id")

    res = await db.watchlists.delete_one({"_id": obj_id, "user_id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return None
