#!/usr/bin/env node
'use strict';
const init = require('../out/index').init;
const args = require('yargs');
const fs = require('fs');
const path = require('path');

args.alias('t', 'tsc')
  .describe('t', 'absolute path to the folder containing a project\'s tsconfig.json file; the rootDir defined in the tsconfig.json file must contain the toJSONSchema.ts file')
  .string('t')
  .usage('$0 . or $0 [options] absPath')
  .help();
const rootDir = (args.argv.t !== undefined)
  ? path.dirname(args.argv.t) : __dirname.replace(path.dirname(args.$0), '');
const tsConfigFilePath = path.join(rootDir, 'tsconfig.json');
console.dir({ tsConfigFilePath });
let src;
let dest;
try {
  const fileData = fs.readFileSync(tsConfigFilePath, { encoding: 'utf8' });
  const data = JSON.parse(fileData.trim().replace(/\r\n/gm, ''));
  console.dir(data);
  src = path.join(rootDir, data.compilerOptions.rootDir);
  dest = path.join(rootDir, data.compilerOptions.outDir);
} catch (err) {
  console.error(err);
  process.exit(1);
}
console.dir({ dest, src, rootDir, __dirname, argv: args.$0 });
if (src === undefined || dest === undefined) {
  console.error('Required arguments were not provided');
  process.exit(1);
} else {
  init(src, dest, tsConfigFilePath, (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
}
