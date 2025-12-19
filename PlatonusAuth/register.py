import os
from typing import Any, Dict

from playwright.sync_api import sync_playwright, TimeoutError


def auth(username: str, password: str) -> Dict[str, Any]:
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_default_timeout(60000)

    page.goto("https://platonus.tau-edu.kz/mail?type=1", wait_until="domcontentloaded")

    try:
      page.wait_for_selector("#login_input", state="visible")
      page.fill("#login_input", username)
      page.fill("#pass_input", password)
    except TimeoutError as exc:
      browser.close()
      raise RuntimeError(
        "login and password"
      ) from exc

    page.click("#Submit1")
    page.wait_for_load_state("networkidle")

    # Если после входа появляется кнопка "Пройти анкетирование",
    # нажимаем её и ждём завершения загрузки.
    survey_button = page.query_selector("text=Пройти анкетирование")
    if survey_button:
      survey_button.click()
      page.wait_for_load_state("networkidle")

    with page.expect_response(
      lambda response: "/rest/student/studentInfo/" in response.url
      and response.request.resource_type == "xhr"
    ) as student_info_response_info:
      page.goto("https://platonus.tau-edu.kz/v7/#/student/personal-info/view")
    student_info_response = student_info_response_info.value
    page.wait_for_load_state("networkidle")
    iin_locator = page.locator("input[name='iin'], #iin").first
    iin_locator.wait_for(state="visible")
    
    # При необходимости можно снова подождать поле ИИН:
    # page.wait_for_selector("#iin", state="visible")

    student_info = student_info_response.json()
    browser.close()

    return {"student_info": student_info}


if __name__ == "__main__":
  env_username = os.getenv("PLATONUS_USERNAME")
  env_password = os.getenv("PLATONUS_PASSWORD")

  if not env_username or not env_password:
    raise SystemExit(
      "Environment variables PLATONUS_USERNAME and PLATONUS_PASSWORD must be set."
    )

  result = auth(env_username, env_password)
  print(result["html"])
