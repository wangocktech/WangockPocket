// Original square-wave effects, stored as small PCM WAVs for native iOS playback.
// Re-run with `node scripts/generate-sounds.mjs` when changing the notes.
import { mkdir, writeFile } from 'node:fs/promises';

const destination = new URL('../assets/sounds/', import.meta.url);
const rate = 44100;
const notes = {
  move: [[260, 0, .07]],
  confirm: [[440, 0, .075], [660, .075, .1]],
  back: [[330, 0, .065], [220, .07, .085]],
  boot: [[262, 0, .08], [330, .1, .08], [392, .2, .08], [523, .3, .15]],
  off: [[180, 0, .14]],
};

await mkdir(destination, { recursive: true });
for (const [name, sequence] of Object.entries(notes)) {
  const duration = Math.max(...sequence.map(([, delay, length]) => delay + length)) + .015;
  const samples = Math.ceil(rate * duration);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++) {
    const time = index / rate;
    let value = 0;
    for (const [frequency, delay, length] of sequence) {
      const local = time - delay;
      if (local < 0 || local >= length) continue;
      const envelope = Math.min(1, local / .004, (length - local) / .012);
      // A little sustain keeps short clicks audible through a phone speaker.
      value += Math.sign(Math.sin(2 * Math.PI * frequency * local)) * .16 * envelope * Math.exp(-local / length);
    }
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + index * 2);
  }
  await writeFile(new URL(`${name}.wav`, destination), wav);
  console.log(`${name}.wav: ${wav.length} bytes`);
}
