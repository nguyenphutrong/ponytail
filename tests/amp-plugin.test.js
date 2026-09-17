#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { LIB_FILES, PLUGIN, SKILLS } = require('../scripts/build-amp-plugin');

const root = path.join(__dirname, '..');
const pluginURL = pathToFileURL(path.join(PLUGIN, 'index.ts')).href;

function harness(plugin) {
  const events = new Map();
  const commands = new Map();
  const skills = [];
  const amp = {
    on(name, handler) { events.set(name, handler); },
    registerCommand(name, options, handler) { commands.set(name, { options, handler }); },
    async registerSkill(definition) { skills.push(definition.path); },
  };
  return Promise.resolve(plugin(amp)).then(() => ({ commands, events, skills }));
}

async function loadPlugin() {
  return (await import(pluginURL)).default;
}

test('Amp bundle contains canonical runtime helpers and skills', () => {
  for (const file of LIB_FILES) {
    assert.equal(
      fs.readFileSync(path.join(PLUGIN, 'lib', file), 'utf8'),
      fs.readFileSync(path.join(root, 'hooks', file), 'utf8'),
      `stale ${file} — run: node scripts/build-amp-plugin.js`,
    );
  }
  for (const skill of SKILLS) {
    assert.equal(
      fs.readFileSync(path.join(PLUGIN, 'skills', skill, 'SKILL.md'), 'utf8'),
      fs.readFileSync(path.join(root, 'skills', skill, 'SKILL.md'), 'utf8'),
      `stale ${skill} skill — run: node scripts/build-amp-plugin.js`,
    );
  }
});

test('Amp plugin registers every bundled skill and its mode command', async () => {
  const { commands, events, skills } = await harness(await loadPlugin());

  assert.deepEqual(skills, SKILLS.map((name) => `skills/${name}`));
  assert.deepEqual([...events.keys()], ['session.start', 'agent.start']);
  assert.ok(commands.has('ponytail.mode'));
});

test('Amp modes are isolated by thread and switches apply on the same turn', async () => {
  const previous = process.env.PONYTAIL_DEFAULT_MODE;
  process.env.PONYTAIL_DEFAULT_MODE = 'full';
  try {
    const { events } = await harness(await loadPlugin());
    const start = events.get('agent.start');

    const ultra = start({ thread: { id: 'one' }, message: '/ponytail ultra', id: 'm1' });
    const normal = start({ thread: { id: 'two' }, message: 'build it', id: 'm2' });

    assert.match(ultra.message.content, /level: ultra/);
    assert.match(normal.message.content, /level: full/);
    assert.doesNotMatch(ultra.message.content, /\| \*\*full\*\*/);
  } finally {
    if (previous === undefined) delete process.env.PONYTAIL_DEFAULT_MODE;
    else process.env.PONYTAIL_DEFAULT_MODE = previous;
  }
});

test('Amp disables only on exact deactivation commands', async () => {
  const { events } = await harness(await loadPlugin());
  const start = events.get('agent.start');

  const off = start({ thread: { id: 'off' }, message: 'normal mode!', id: 'm1' });
  const afterOff = start({ thread: { id: 'off' }, message: 'build it', id: 'm2' });
  const mention = start({ thread: { id: 'active' }, message: 'add a normal mode toggle', id: 'm3' });

  assert.match(off.message.content, /PONYTAIL MODE OFF/);
  assert.equal(afterOff, undefined);
  assert.match(mention.message.content, /PONYTAIL MODE ACTIVE/);
});

test('Amp command palette changes only the active thread mode', async () => {
  const { commands, events } = await harness(await loadPlugin());
  const notifications = [];
  const ctx = {
    thread: { id: 'selected' },
    ui: {
      select: async () => 'lite',
      notify: async (message) => notifications.push(message),
    },
  };

  await commands.get('ponytail.mode').handler(ctx);
  const selected = events.get('agent.start')({ thread: { id: 'selected' }, message: 'work', id: 'm1' });
  const other = events.get('agent.start')({ thread: { id: 'other' }, message: 'work', id: 'm2' });

  assert.match(selected.message.content, /level: lite/);
  assert.match(other.message.content, /level: full/);
  assert.deepEqual(notifications, ['Ponytail mode set to lite for this thread.']);
});
