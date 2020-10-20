#! /usr/bin/env node
//
// Copyright 2020 Picovoice Inc.
//
// You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
// file accompanying this source.
//
// Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//
"use strict";

const { program } = require("commander");
const fs = require("fs");
const Picovoice = require("@picovoice/picovoice-node");

const {
  BUILTIN_KEYWORDS_STRINGS,
  BUILTIN_KEYWORDS_STRING_TO_ENUM,
} = require("@picovoice/porcupine-node/builtin_keywords");

const WaveFile = require("wavefile").WaveFile;

const {
  getInt16Frames,
  checkWaveFile,
} = require("@picovoice/rhino-node/wave_util");

program
  .requiredOption(
    "-i, --input_audio_file_path <string>",
    "input audio wave file in 16-bit 16KHz linear PCM format (mono)"
  )
  .option(
    "-k, --keyword_file_path <string>",
    "absolute path(s) to porcupine keyword files (.ppn extension)"
  )
  .option(
    "-b, --keyword <string>",
    `built in keyword(s) (${Array.from(BUILTIN_KEYWORDS_STRINGS)})`
  )
  .requiredOption(
    "-c, --context_file_path <string>",
    `absolute path to rhino context (.rhn extension)`
  )
  .option(
    "-s, --sensitivity <number>",
    "sensitivity value between 0 and 1",
    parseFloat,
    0.5
  )
  .option(
    "--porcupine_library_file_path <string>",
    "absolute path to porcupine dynamic library"
  )
  .option(
    "--porcupine_model_file_path <string>",
    "absolute path to porcupine model"
  )
  .option(
    "--rhino_library_file_path <string>",
    "absolute path to rhino dynamic library"
  )
  .option("--rhino_model_file_path <string>", "absolute path to rhino model");

if (process.argv.length < 3) {
  program.help();
}
program.parse(process.argv);

function fileDemo() {
  let audioPath = program["input_audio_file_path"];
  let keywordFilePath = program["keyword_file_path"];
  let keyword = program["keyword"];
  let contextPath = program["context_file_path"];
  let sensitivity = program["sensitivity"];
  let porcupineLibraryFilePath = program["porcupine_library_file_path"];
  let porcupineModelFilePath = program["porcupine_model_file_path"];
  let rhinoLibraryFilePath = program["rhino_library_file_path"];
  let rhinoModelFilePath = program["rhino_model_file_path"];

  let keywordPathsDefined = keywordFilePath !== undefined;
  let builtinKeywordsDefined = keyword !== undefined;
  let friendlyKeywordName;

  if (
    (keywordPathsDefined && builtinKeywordsDefined) ||
    (!keywordPathsDefined && !builtinKeywordsDefined)
  ) {
    console.error(
      "One of --keyword_file_paths or --keywords is required: Specify a built-in --keyword (e.g. 'GRASSHOPPER'), or a --keyword_file_path to a .ppn file"
    );
    return;
  }

  let keywordArgument;
  if (builtinKeywordsDefined) {
    let keywordString = keyword.trim().toLowerCase();
    if (BUILTIN_KEYWORDS_STRINGS.has(keywordString)) {
      keywordArgument = BUILTIN_KEYWORDS_STRING_TO_ENUM.get(keywordString);
      friendlyKeywordName = keywordString;
    } else {
      console.error(
        `Keyword argument '${keywordString}' is not in the list of built-in keywords (${Array.from(
          BUILTIN_KEYWORDS_STRINGS
        )})`
      );
      return;
    }
  } else {
    keywordArgument = keywordFilePath;
    friendlyKeywordName = keywordFilePath
      .split(/[\\|\/]/)
      .pop()
      .split("_")[0];
  }

  if (isNaN(sensitivity) || sensitivity < 0 || sensitivity > 1) {
    console.error("--sensitivity must be a number in the range [0,1]");
    return;
  }

  if (!fs.existsSync(contextPath)) {
    throw new PvArgumentError(
      `File not found at 'contextPath': ${contextPath}`
    );
  }

  let keywordCallback = function (keyword) {
    console.log(`Wake word '${friendlyKeywordName}' detected`);
    console.log(
      `Listening for speech within the context of '${contextName}'`
    );
  };

  let inferenceCallback = function (inference) {
    console.log();
    console.log("Inference:");
    console.log(JSON.stringify(inference, null, 4));
    console.log();
    console.log();
    console.log(`Listening for wake word '${friendlyKeywordName}'`);
  };

  let handle = new Picovoice(
    keywordArgument,
    keywordCallback,
    contextPath,
    inferenceCallback,
    sensitivity,
    sensitivity,
    porcupineModelFilePath,
    porcupineLibraryFilePath,
    rhinoModelFilePath,
    rhinoLibraryFilePath
  );

  console.log("Context info:");
  console.log("-------------");
  console.log(handle.contextInfo);

  let contextName = contextPath
    .split(/[\\|\/]/)
    .pop()
    .split("_")[0];

  let audioFileName = audioPath.split(/[\\|\/]/).pop();

  if (!fs.existsSync(audioPath)) {
    console.error(`--input_audio_file_path file not found: ${audioPath}`);
    return;
  }

  let waveBuffer = fs.readFileSync(audioPath);
  let inputWaveFile;
  try {
    inputWaveFile = new WaveFile(waveBuffer);
  } catch (error) {
    console.error(`Exception trying to read file as wave format: ${audioPath}`);
    console.error(error);
    return;
  }

  if (!checkWaveFile(inputWaveFile, handle.sampleRate)) {
    console.error(
      "Audio file did not meet requirements. Wave file must be 16KHz, 16-bit, linear PCM (mono)."
    );
  }

  let frames = getInt16Frames(inputWaveFile, handle.frameLength);

  for (let frame of frames) {
    handle.process(frame);
  }

  handle.release();
}

fileDemo();
