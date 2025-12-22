import os
from typing import Any, Dict

from playwright.sync_api import sync_playwright, TimeoutError, Error


def auth(username: str, password: str) -> Dict[str, Any]:
  print("Starting Platonus authentication for user:", username)
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

    cookies = page.context.cookies("https://platonus.tau-edu.kz")
    cookie_map = {cookie["name"]: cookie["value"] for cookie in cookies}
    cookie_header = "; ".join(
      f"{cookie['name']}={cookie['value']}" for cookie in cookies
    )
    user_agent = page.evaluate("() => navigator.userAgent")
    sid_value = cookie_map.get("plt_sid") or cookie_map.get("sid") or ""
    try:
      token_value = page.evaluate(
        "() => localStorage.getItem('token') || localStorage.getItem('access_token') || ''"
      )
    except Error:
      page.wait_for_load_state("domcontentloaded")
      token_value = page.evaluate(
        "() => localStorage.getItem('token') || localStorage.getItem('access_token') || ''"
      )

    headers = {
      "cookie": cookie_header,
      "sid": sid_value,
      "token": token_value,
      "user-agent": user_agent,
      "accept": "application/json",
      "accept-language": "kz",
    }
    person_id_response = page.request.get(
      "https://platonus.tau-edu.kz/rest/api/person/personID",
      headers=headers,
    )
    try:
      person_data = person_id_response.json()
    except ValueError:
      print("person_id_response_status:", person_id_response.status)
      print("person_id_response_text:", person_id_response.text())
      browser.close()
      raise RuntimeError("personID response is not JSON")
    person_id = person_data.get("personID")
    if not person_id:
      person_id_retry = page.request.get(
        "https://platonus.tau-edu.kz/rest/api/person/personID",
        headers=headers,
      )
      try:
        person_data_retry = person_id_retry.json()
      except ValueError:
        print("person_id_retry_status:", person_id_retry.status)
        print("person_id_retry_text:", person_id_retry.text())
        browser.close()
        raise RuntimeError("personID retry response is not JSON")
      person_id = person_data_retry.get("personID")
    print("person_id_response:", person_data)
    print("person_id_response_status:", person_id_response.status)
    print("cookies:", cookie_map)
    print("user_agent:", user_agent)
    print("sid:", sid_value)
    print("token:", token_value)
    print("request_headers:", headers)
    student_info_response = page.request.get(
      f"https://platonus.tau-edu.kz/rest/student/studentInfo/{person_id}/ru",
      headers=headers,
    )
    try:
      student_info = student_info_response.json()
    except ValueError:
      print("student_info_response_status:", student_info_response.status)
      print("student_info_response_text:", student_info_response.text())
      browser.close()
      raise RuntimeError("studentInfo response is not JSON")
    print("student_info_response:", student_info)
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
