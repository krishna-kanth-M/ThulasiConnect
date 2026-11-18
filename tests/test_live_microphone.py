
import sounddevice as sd
import numpy as np
from faster_whisper import WhisperModel

SAMPLE_RATE = 16000
DURATION = 5

print("Loading Faster-Whisper...")
model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8",
    download_root="ai-services/models"
)

print("\nSpeak something in English or Tamil.")
print("Microphone will capture 5 seconds of audio...")

audio = sd.rec(
    int(DURATION * SAMPLE_RATE),
    samplerate=SAMPLE_RATE,
    channels=1,
    dtype="float32"
)

sd.wait()

# Transcribe directly from memory. No audio file is created.
audio = np.squeeze(audio)

segments, info = model.transcribe(
    audio,
    beam_size=3,
    vad_filter=True
)

print("\nDetected language:", info.language)
print("\nTranscription:")

for segment in segments:
    print(f"[{segment.start:.2f}s - {segment.end:.2f}s] {segment.text}")

print("\nLive microphone test completed.")