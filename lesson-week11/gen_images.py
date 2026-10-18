#!/usr/bin/env python3
"""SODA AI LAB 11주차 교안용 이미지 생성 (OpenAI 이미지 API)
실행:  cd ~/Desktop/project/soda-talk && python3 lesson-week11/gen_images.py
       특정 이미지만 다시:  python3 lesson-week11/gen_images.py 03_skillcard
키: 환경변수 OPENAI_API_KEY → 없으면 data/db.json 의 settings.openaiApiKey
9주차 교안의 나무 소다봇(ref/ 폴더)을 참조 이미지로 넣어 캐릭터를 통일합니다.
"""
import base64, json, os, sys, uuid, urllib.request, urllib.error, pathlib, time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / "images"; OUT.mkdir(exist_ok=True)
MODEL = os.environ.get("IMG_MODEL", "gpt-image-1")
QUALITY = os.environ.get("IMG_QUALITY", "high")

key = os.environ.get("OPENAI_API_KEY")
if not key:
    try: key = json.load(open(ROOT / "data/db.json"))["settings"]["openaiApiKey"]
    except Exception: pass
if not key: sys.exit("OPENAI_API_KEY 가 없습니다.")

ROBOT = ("SODABOT: the exact robot from the reference images - a small boxy robot made of light natural wood/plywood, "
         "a black LCD screen face with glowing cyan oval eyes and a small smile, a yellow ball antenna on top, "
         "grey round ear speakers on both sides.")
NOTEXT = "Absolutely no text, letters, Korean or English words, numbers, logos or watermarks anywhere."
LIGHT = ("Soft 3D clay-like render, matte materials, clean very light grey-white background (#F7F9FC), "
         "gentle soft shadows, minimal and friendly, accent color bright blue (#1D6FE0).")
DARK = ("Cinematic product shot on a deep dark navy-black background with a glowing electric blue light ring and bokeh, "
        "dramatic rim lighting, premium look.")

IMAGES = {
 # (설명, 참조이미지, 비율)
 "01_cover": (f"{ROBOT} The robot stands on the right third of the frame. Around it float four glowing translucent glass cards, "
              f"each with one simple icon: a globe with speech bubble, code brackets, a graduation cap, a sparkle star. "
              f"Left half of the image is empty dark space for a title. {DARK} {NOTEXT}", "cover", "1536x1024"),
 "02_roles":  (f"Four copies of {ROBOT} standing in a neat row, each with a different small prop beside it: "
              f"1) a small globe and a speech bubble, 2) a tiny laptop showing code bracket symbols, "
              f"3) an open book and a magnifying glass, 4) a glowing sparkle star and a pencil. "
              f"Same body for all four, only the prop and the eye expression differ. {LIGHT} {NOTEXT}", "icons", "1536x1024"),
 "03_skillcard": (f"Concept illustration: {ROBOT} on the right. Above-left, a soft grey cloud with a small dark server box. "
              f"A glowing blue translucent card slides from the cloud down into a slot on the top of the robot, like inserting a game cartridge. "
              f"A screwdriver and a circuit board lie untouched beside the robot to show the hardware is not changed. {LIGHT} {NOTEXT}", "icons", "1536x1024"),
 "04_rules":  (f"{ROBOT} holding up a small clipboard. Two large floating round badges next to it: one green with a white check mark, "
              f"one coral red with a white X mark. Simple and iconic. {LIGHT} {NOTEXT}", "icons", "1536x1024"),
 "05_compare":(f"Two copies of {ROBOT} side by side with a blue arrow between them. Left robot looks a bit confused (eyes as dots) "
              f"with a big messy speech bubble full of many grey scribble lines. Right robot looks happy with a small, neat speech bubble "
              f"with just two short blue lines and a tiny sparkle. Shows 'before and after improvement'. {LIGHT} {NOTEXT}", "icons", "1536x1024"),
 "06_safety": (f"{ROBOT} holding a soft glowing blue shield with a white heart symbol in front of itself, calm and reassuring. "
              f"{LIGHT} {NOTEXT}", "icons", "1024x1024"),
 "07_report": (f"{ROBOT} sitting on a light wooden desk next to two printed A4 worksheet pages with blank boxes and a photo frame area, "
              f"a pencil, and a couple of star stickers. Top-down three-quarter view. The pages contain only abstract grey lines, no readable text. "
              f"{LIGHT} {NOTEXT}", "icons", "1536x1024"),
 "08_next":   (f"{ROBOT} waving one small hand, viewed slightly from below, surrounded by small glowing blue particles and stars. "
              f"Right half of the frame empty for text. {DARK} {NOTEXT}", "cover", "1536x1024"),
}

def post_multipart(url, fields, files):
    b = uuid.uuid4().hex; body = bytearray()
    for k, v in fields.items():
        body += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for k, name, data, ctype in files:
        body += (f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"; filename=\"{name}\"\r\n"
                 f"Content-Type: {ctype}\r\n\r\n").encode() + data + b"\r\n"
    body += f"--{b}--\r\n".encode()
    req = urllib.request.Request(url, data=bytes(body), headers={
        "Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={b}"})
    return json.load(urllib.request.urlopen(req, timeout=400))

refs = {n: (HERE / "ref" / f"ref_{n}.png").read_bytes() for n in ("cover", "icons")}
only = set(sys.argv[1:])
for name, (prompt, refname, size) in IMAGES.items():
    if only and name not in only: continue
    path = OUT / f"{name}.png"
    if path.exists() and not only: print("이미 있음:", path.name); continue
    files = [("image[]", f"ref_{refname}.png", refs[refname], "image/png")]
    if refname == "icons": files.append(("image[]", "ref_cover.png", refs["cover"], "image/png"))
    print("생성 중:", name, flush=True)
    try:
        r = post_multipart("https://api.openai.com/v1/images/edits",
                           {"model": MODEL, "prompt": prompt, "size": size, "quality": QUALITY}, files)
        path.write_bytes(base64.b64decode(r["data"][0]["b64_json"]))
        print("  저장:", path, flush=True)
    except urllib.error.HTTPError as e:
        print("  실패:", e.code, e.read().decode()[:500])
    time.sleep(1)
print("\n완료 →", OUT)
