import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { getDefaultMode, isDeactivationCommand, normalizeMode } = require('./lib/ponytail-config.js')
const { getPonytailInstructions } = require('./lib/ponytail-instructions.js')

const SKILLS = [
	'ponytail',
	'ponytail-review',
	'ponytail-audit',
	'ponytail-debt',
	'ponytail-gain',
	'ponytail-help',
]

export const description = 'Adds Ponytail lazy senior developer guidance, per-thread intensity controls, and six bundled skills.'

export default async function (amp) {
	const modes = new Map()
	const modeFor = (threadID) => modes.get(threadID) || getDefaultMode()

	await Promise.all(SKILLS.map((name) => amp.registerSkill({ path: `skills/${name}` })))

	amp.on('session.start', (event) => {
		if (!modes.has(event.thread.id)) modes.set(event.thread.id, getDefaultMode())
	})

	amp.on('agent.start', (event) => {
		const text = String(event.message || '').trim()
		const switchMatch = text.match(/^\/ponytail\s+(lite|full|ultra|off)[.!?]*$/i)
		if (switchMatch) modes.set(event.thread.id, normalizeMode(switchMatch[1]))
		else if (isDeactivationCommand(text)) modes.set(event.thread.id, 'off')

		const mode = modeFor(event.thread.id)
		if (mode === 'off') {
			if (switchMatch || isDeactivationCommand(text)) {
				return { message: { content: 'PONYTAIL MODE OFF. Confirm the mode change briefly, then follow the user request normally.' } }
			}
			return
		}

		return { message: { content: getPonytailInstructions(mode) } }
	})

	amp.registerCommand(
		'ponytail.mode',
		{
			title: 'Set Mode',
			category: 'Ponytail',
			description: 'Set Ponytail intensity for the active thread.',
		},
		async (ctx) => {
			if (!ctx.thread) {
				await ctx.ui.notify('Start a thread before setting its Ponytail mode.')
				return
			}

			const current = modeFor(ctx.thread.id)
			const selected = await ctx.ui.select({
				title: 'Ponytail mode',
				message: `Current mode: ${current}`,
				options: ['lite', 'full', 'ultra', 'off'],
			})
			if (!selected) return
			modes.set(ctx.thread.id, selected)
			await ctx.ui.notify(`Ponytail mode set to ${selected} for this thread.`)
		},
	)
}
