#!/usr/bin/env node
// Build the self-contained Amp directory plugin from Ponytail's canonical
// runtime helpers and skills. Amp global plugin repositories only publish the
// plugin directory, so its relative imports and registered skills must live
// inside that directory.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLUGIN = path.join(ROOT, '.amp', 'plugins', 'ponytail');
const LIB_FILES = ['ponytail-config.js', 'ponytail-instructions.js'];
const SKILLS = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
];

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function build() {
  fs.rmSync(path.join(PLUGIN, 'lib'), { recursive: true, force: true });
  fs.rmSync(path.join(PLUGIN, 'skills'), { recursive: true, force: true });

  for (const file of LIB_FILES) {
    copyFile(path.join(ROOT, 'hooks', file), path.join(PLUGIN, 'lib', file));
  }
  for (const skill of SKILLS) {
    fs.cpSync(path.join(ROOT, 'skills', skill), path.join(PLUGIN, 'skills', skill), { recursive: true });
  }
}

module.exports = { build, LIB_FILES, PLUGIN, SKILLS };

if (require.main === module) {
  build();
  console.log('built .amp/plugins/ponytail');
}
