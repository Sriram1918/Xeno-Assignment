"""Segment preview endpoint: validate a SegmentSpec against live data without sending anything."""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..db import get_session
from ..schemas import SegmentPreview, SegmentSpec
from ..segments import preview_segment

router = APIRouter(prefix="/segments", tags=["segments"])


@router.post("/preview", response_model=SegmentPreview)
def preview(spec: SegmentSpec, session: Session = Depends(get_session)):
    return preview_segment(session, spec)
