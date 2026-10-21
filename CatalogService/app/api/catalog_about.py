from fastapi import APIRouter
from pydantic import BaseModel
from typing import Literal

router = APIRouter()


class AboutInfo(BaseModel):
    """Information about the library"""
    founded_date: str
    mission: str


ABOUT_TRANSLATIONS = {
    "kk": {
        "founded_date": "«Тұран-Астана» университетінің кітапханасы алғашқы оқырмандарын 1998 жылғы қыркүйекте қабылдады.",
        "mission": "Кітапханалық-ақпараттық орталықтың миссиясы — маңызды әрі өзекті ақпаратты іріктеу, қорды толықтыру және жүйелеу, оған барынша қолжетімділікті қамтамасыз ету арқылы университеттегі оқу мен ғылыми зерттеулердің сапасын арттыруға үлес қосу. Орталық заманауи ақпараттық-коммуникациялық технологиялар негізінде оқырмандардың барлық санатына кітапханалық-ақпараттық қызмет көрсетеді.",
    },
    "en": {
        "founded_date": "The Turan-Astana University library welcomed its first readers in September 1998.",
        "mission": "The Library and Information Centre supports the university in improving teaching and research through the selection, acquisition and organisation of relevant, up-to-date information and broad access to it. It provides library and information services to all categories of readers using modern information and communication technologies.",
    },
}


@router.get("/about", response_model=AboutInfo)
def get_about_info(lang: Literal["ru", "kk", "en"] = "ru"):
    """
    Get information about the library. Guest access allowed.
    """
    if lang in ABOUT_TRANSLATIONS:
        return AboutInfo(**ABOUT_TRANSLATIONS[lang])
    return AboutInfo(
        founded_date="Библиотека университета «Туран-Астана» приняла своих первых читателей в сентябре 1998 года.",
        mission="""Миссия библиотечно-информационного центра – содействие университету в повышении качества учебной деятельности и уровня научных исследований посредством отбора, комплектования, систематизации и обеспечения и максимального доступа к значимой и актуальной информации, предоставления библиотечно – информационных услуг на базе современных информационно – коммуникационных технологий всем категориям читателей."""
    )
