#!/usr/bin/env node
import { Command } from 'commander'
import { initCmd } from './commands/init.js'
import { startCmd } from './commands/start.js'

import { contextCmd } from './commands/context.js'
import { whyCmd } from './commands/why.js'
import { failuresCmd } from './commands/failures.js'
import { statusCmd } from './commands/status.js'
import { conflictsCmd } from './commands/conflicts.js'

const program = new Command()

program
  .name('mc')
  .description('MissionControl CLI')
  .version('0.1.0')

program.addCommand(initCmd)
program.addCommand(startCmd)

program.addCommand(contextCmd)
program.addCommand(whyCmd)
program.addCommand(failuresCmd)
program.addCommand(statusCmd)
program.addCommand(conflictsCmd)

program.parse()
