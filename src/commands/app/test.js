/*
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { runScript } = require('../../lib/app-helper')
const { flags } = require('@oclif/command')
const BaseCommand = require('../../BaseCommand')
const chalk = require('chalk')

class Test extends BaseCommand {
  async run () {
    const { flags } = this.parse(Test)
    let { all, unit, e2e, action } = flags

    // 'all' overrides the setting of either the unit or e2e flag
    if (all) {
      unit = true
      e2e = true
    } else if (!unit && !e2e) {
      // 'all' not set; we check if neither is set, and default to 'unit'
      unit = true
    }

    const buildConfigs = this.getAppExtConfigs(flags)
    for (const extensionName of Object.keys(buildConfigs)) {
      await this.runExtensionTest(extensionName, buildConfigs[extensionName], { unit, e2e, action })
    }
  }

  normalizedActionList (extensionConfig) {
    const actionList = []
    const packages = extensionConfig.manifest.full.packages
    for (const [packageName, pkg] of Object.entries(packages)) {
      const actions = pkg.actions

      for (const actionName of Object.keys(actions)) {
        actionList.push([packageName, actionName])
      }
    }
    return actionList
  }

  escapeBackslashes (pathString) {
    // for Jest:
    // - replace backslashes with forward slashes,
    // - OR on Windows you need to escape forward slashes
    return pathString.replace(/\\/g, '\\\\')
  }

  testFolders (extensionConfig) {
    return {
      unit: this.escapeBackslashes(extensionConfig.tests.unit),
      e2e: this.escapeBackslashes(extensionConfig.tests.e2e)
    }
  }

  filterActions (actionFilters, extensionConfig, flags) {
    const { unit, e2e } = flags
    const commandList = []
    const { unit: unitTestFolder, e2e: e2eTestFolder } = this.testFolders(extensionConfig)

    // filter by action(s)
    const actionList = this.normalizedActionList(extensionConfig)
      .filter(([packageName, actionName]) => {
        const actionFullName = `${packageName}/${actionName}`
        return actionFilters
          .filter(actionFilter => {
            return actionFullName.includes(actionFilter)
          })
          .length > 0
      })

    actionList.forEach(([, actionName]) => {
      const pattern = `.*/${actionName}.test.js`
      if (unit) {
        commandList.push({
          type: 'unit',
          command: 'jest',
          args: ['--passWithNoTests', '--testPathPattern', `${unitTestFolder}/${pattern}`]
        })
      }
      if (e2e) {
        commandList.push({
          type: 'e2e',
          command: 'jest',
          args: ['--passWithNoTests', '--testPathPattern', `${e2eTestFolder}/${pattern}`]
        })
      }
    })

    return commandList
  }

  async runExtensionTest (extensionName, extensionConfig, flags) {
    const { unit, e2e, action } = flags
    const commandList = []
    const { unit: unitTestFolder, e2e: e2eTestFolder } = this.testFolders(extensionConfig)

    // if hooks.test available, we run that instead
    if (extensionConfig.hooks.test) {
      commandList.push({
        type: 'hook',
        command: extensionConfig.hooks.test
      })
    } else if (action) { // filter by ext/action name
      const commands = await this.filterActions(action, extensionConfig, flags)
      if (commands.length === 0) {
        this.log(`No package and action matches action filter(s): ${JSON.stringify(action)}`)
      }
      commandList.push(...commands)
    } else { // run everything
      if (unit) {
        commandList.push({
          type: 'unit',
          command: 'jest',
          args: ['--passWithNoTests', unitTestFolder]
        })
      }
      if (e2e) {
        commandList.push({
          type: 'e2e',
          command: 'jest',
          args: ['--passWithNoTests', e2eTestFolder]
        })
      }
    }

    for (const cmd of commandList) {
      console.log(chalk.yellow(`Running ${cmd.type} tests for ${extensionName}...`))
      await runScript(cmd.command, extensionConfig.root, cmd.args)
    }
  }
}

Test.flags = {
  extension: flags.string({
    char: 'e',
    description: 'the extension(s) to test',
    exclusive: ['action'],
    multiple: true
  }),
  action: flags.string({
    char: 'a',
    description: 'the action(s) to test',
    exclusive: ['extension'],
    multiple: true
  }),
  all: flags.boolean({
    description: 'run both unit and e2e tests',
    default: false
  }),
  e2e: flags.boolean({
    description: 'run e2e tests',
    default: false,
    allowNo: true
  }),
  unit: flags.boolean({
    description: 'run unit tests',
    default: false,
    allowNo: true
  })
}

Test.description = `Run tests for an Adobe I/O App
If the extension has a hook called 'test' in its ext.config.yaml, the script specified will be run instead.
`
module.exports = Test
