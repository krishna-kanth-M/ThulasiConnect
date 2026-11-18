
import sounddevice as sd
import soundfile as sf
from pathlib import Path

output = Path("tests/sample.wav")
sample_rate = 16000
duration = 10

print("Recording starts in 3 seconds...")
sd.sleep(3000)

print("Speak now for 10 seconds!")

audio = sd.rec(
    int(duration * sample_rate),
    samplerate=sample_rate,
    channels=1,
    dtype="float32"
)

sd.wait()
sf.write(output, audio, sample_rate)

print("Audio saved:", output)
