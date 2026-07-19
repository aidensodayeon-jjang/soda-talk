import fs from "fs";
import wavefilePkg from "wavefile";
const { WaveFile } = wavefilePkg;
import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = false;

async function test() {
  console.log("Loading model...");
  const transcribe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
  console.log("Model loaded.");
}
test().catch(console.error);
