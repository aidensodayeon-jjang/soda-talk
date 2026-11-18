# Synthesizes soundtrack.wav (BGM + SFX) synced to index.html's timeline.
# SFX reuse the robot's own presets from src/utils/sodabotSounds.ts (chime/rise/beep/bounce).
#   python3 soundtrack.py   → soundtrack.wav (record.mjs muxes it in automatically)
import wave, os
import numpy as np

SR, DUR = 44100, 39.8
N = int(SR * DUR)
rng = np.random.default_rng(7)
L, R = np.zeros(N), np.zeros(N)


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    s = sig[:N - i] * gain
    a = (pan + 1) * np.pi / 4
    L[i:i + len(s)] += s * np.cos(a) * 1.414
    R[i:i + len(s)] += s * np.sin(a) * 1.414


def ts(d): return np.arange(int(d * SR)) / SR
def midi(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, k): return np.convolve(x, np.ones(k) / k, 'same')
def noise(d): return rng.uniform(-1, 1, int(d * SR))


def tone(f, d, attack=.005, decay=None, harm=((1, 1),), vib=0):
    t = ts(d)
    ph = 2 * np.pi * f * t + (vib and 0.02 * f / 30 * np.sin(2 * np.pi * 30 * t))
    s = sum(a * np.sin(h * ph) for h, a in harm)
    env = np.minimum(1, t / attack) * (np.exp(-t / decay) if decay else 1)
    env *= np.minimum(1, (d - t) / .02)  # click-free tail
    return s * env


def sweep(f0, f1, d, decay):
    t = ts(d)
    f = f0 + (f1 - f0) * np.minimum(1, t / (d * .6))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay) * np.minimum(1, t / .003)


# ── SFX ──
BELL = ((1, 1), (2, .4), (3.01, .15))
def chime(t):  # power_on preset: 440 150ms → 880 250ms
    add(tone(440, .5, decay=.2, harm=BELL), t, .22)
    add(tone(880, .8, decay=.3, harm=BELL), t + .15, .2)
def rise(t):  # greeting preset: 도-미-솔
    for i, f in enumerate((523, 659, 784)):
        add(tone(f, .6, decay=.12 if i < 2 else .3, harm=BELL), t + i * .12, .2)
def beep(t): add(tone(1000, .08, harm=((1, 1), (3, .25), (5, .1))), t, .12)  # button_click preset
def bounce(t, up=1.0):  # touch_react preset 400 → 600, used for bubble pops
    add(sweep(400 * up, 600 * up, .1, .06), t, .25)
    add(tone(600 * up, .25, decay=.08), t + .08, .15)
def pop(t, f=520, g=.2): add(sweep(f, f * 1.6, .12, .05), t, g, pan=rng.uniform(-.3, .3))
def tick(t):
    n = noise(.015); n = (n - lp(n, 4)) * np.exp(-ts(.015) / .004)
    add(n, t, .22, pan=rng.uniform(-.2, .2))
    add(tone(rng.uniform(1800, 2600), .02, decay=.005), t, .05)
def blip(t): add(tone(1400, .06, decay=.02), t, .06)
def whoosh(t, d=.7, g=.16):
    x = noise(d); x = lp(x, 14) - lp(x, 60)
    add(x * np.sin(np.pi * (ts(d) / d) ** .6) ** 2, t, g)
def impact(t):
    add(sweep(90, 45, .9, .35), t, .55)
    add(lp(noise(.4), 8) * np.exp(-ts(.4) / .08), t, .35)
def click(t):  # mechanical button press + release, then the robot beep
    for dt, g in ((0, .4), (.05, .25)):
        n = noise(.01); add((n - lp(n, 3)) * np.exp(-ts(.01) / .002), t + dt, g)
    add(sweep(180, 90, .06, .02), t, .35)
    beep(t + .08)
def babble(t):  # robot voice syllable synced to the mouth opening
    add(tone(rng.uniform(380, 580), .09, attack=.01, harm=((1, 1), (2, .5), (3, .25)), vib=1), t, .1)


# ── BGM: C major, 100 BPM, Fmaj7 – G – Em7 – Am7 ──
BEAT, BAR = .6, 2.4
CHORDS = [[53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 62], [57, 60, 64, 67]]
TALK = (24.8, 32.6)  # conversation scene: drums out so SFX read clearly
END = 36.2
music_L, music_R = L, R
L, R = np.zeros(N), np.zeros(N)  # build music on its own bus
for b in range(int(END / BAR) + 1):
    t0, ch = b * BAR, CHORDS[b % 4]
    for m in ch:
        for det in (1, 1.0025):
            add(tone(midi(m) * det, BAR + .4, attack=.35, harm=((1, 1), (2, .25), (3, .08))), t0, .035)
    for i, k in enumerate([0, 1, 2, 3, 2, 1, 2, 3]):
        t = t0 + i * BEAT / 2
        if t < END: add(tone(midi(ch[k] + 12), .4, decay=.16, harm=((1, 1), (2, .3))), t, .07, pan=(-.35, .35)[i % 2])
    if t0 < 3.0: continue
    talk = TALK[0] <= t0 < TALK[1]
    for beat in range(4):
        t = t0 + beat * BEAT
        if t >= END: break
        if not talk:
            if beat in (0, 2): add(sweep(120, 45, .3, .12), t, .45)
            if beat in (1, 3): n = noise(.15); add((n - lp(n, 20)) * np.exp(-ts(.15) / .04), t, .16)
            if beat in (0, 2): add(tone(midi(ch[0] - 12), .5, decay=.3, harm=((1, 1), (2, .3))), t, .22)
        n = noise(.03); add((n - lp(n, 3)) * np.exp(-ts(.03) / .012), t + BEAT / 2, .05, pan=.25)
# final chord with the logo hit
for m in [41, 53, 57, 60, 64, 67]:
    add(tone(midi(m), 3.8, attack=.02, decay=1.6, harm=((1, 1), (2, .3), (3, .1))), 36.7, .07)
t = np.arange(N) / SR
duck = np.where((t > TALK[0] + .3) & (t < TALK[1] - .2), .55, 1.0)
duck = lp(duck, 4000)
L, R = music_L + L * duck, music_R + R * duck

# ── SFX timeline (seconds match index.html scene starts + local times) ──
chime(.25); blip(1.35)
for k in range(1, 13): tick(1 + k / 12)             # "안녕! 나는 소다봇이야"
rise(2.05)
whoosh(3.05, 1.6, .2); impact(4.75); pop(5.05, 660, .12); pop(5.6); blip(5.9); blip(7.2)
# STEP 1 표정 그리기 (7.8): one soft blip per painted pixel pair
whoosh(7.6); pop(8.0, 440, .12)
for i in range(41): add(tone(rng.choice([880, 988, 1175, 1319]), .05, decay=.02), 8.6 + i / 41 * 2.5, .05)
pop(11.2, 520, .12); click(11.75); whoosh(12.0); rise(12.4)
# STEP 2 친구 설정 (14.4)
whoosh(14.2); pop(14.6, 440, .12); tick(15.2); tick(15.4)
for i, tt in enumerate((15.7, 16.2, 16.7)): bounce(tt, 1 + i * .15)
pop(17.2, 660, .14); pop(17.7, 784, .14); click(18.35); chime(18.6)
# STEP 3 대화 (19.6)
whoosh(19.4); bounce(20.0, 1.3); bounce(21.3, .9); blip(21.6); bounce(22.3, 1.3); bounce(23.4, .9)
# 소다봇 음성 대화 (24.8)
whoosh(24.65); click(24.9); bounce(25.5, 1.3)
for k in range(1, 13): tick(25.5 + k / 12 * 1.0)    # "소다야, 나 골 넣었어!"
bounce(27.4)
for i, f in enumerate((660, 740, 830)): add(tone(f, .3, decay=.1), 27.65 + i * .4, .08)
bounce(29.1, .9)
prev = False
for lt in np.arange(4.3, 7.4, 1 / 60):               # mirrors scene4's mouth formula
    op = np.sin(lt * 17) + np.sin(lt * 6.3) > 0
    if op and not prev: babble(24.8 + lt)
    prev = op
whoosh(32.45); pop(32.9, 440); pop(33.05, 520); pop(33.35, 660)
for i in range(3): tick(34.0 + i * .12)
rise(34.1)
chime(36.2); impact(36.7); blip(37.2); rise(37.8); pop(38.05, 660, .14)

# ── master: soft clip, fade out with the picture ──
mix = np.stack([L, R], 1)
mix *= np.minimum(1, (DUR - t) / .6)[:, None] * np.minimum(1, t / .05)[:, None]
mix = np.tanh(mix * 1.1)
mix *= .89 / np.abs(mix).max()
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'soundtrack.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', out)
