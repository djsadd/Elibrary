from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class AboutInfo(BaseModel):
    """Information about the library"""
    founded_date: str
    mission: str


@router.get("/about", response_model=AboutInfo)
def get_about_info():
    """
    Get information about the library. Guest access allowed.
    """
    return AboutInfo(
        founded_date="Библиотека университета «Туран-Астана» приняла своих первых читателей в сентябре 1998 года.",
        mission="""Миссия библиотечно-информационного центра – содействие университету в повышении качества учебной деятельности и уровня научных исследований посредством отбора, комплектования, систематизации и обеспечения и максимального доступа к значимой и актуальной информации, предоставления библиотечно – информационных услуг на базе современных информационно – коммуникационных технологий всем категориям читателей."""
    )
