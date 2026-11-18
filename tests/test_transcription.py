
from faster_whisper import WhisperModel

print("Loading Faster-Whisper...")

model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8",
    download_root="ai-services/models"
)

print("Model loaded successfully!")
print("Waiting for an audio file...")

audio_file = "tests/sample.wav"

segments, info = model.transcribe(
    audio_file,
    beam_size=3,
    vad_filter=True
)

print(f"\nDetected language: {info.language}")
print("\nTranscription:")

for segment in segments:
    print(f"[{segment.start:.2f}s - {segment.end:.2f}s] {segment.text}")

print("\nTranscription test completed.")
