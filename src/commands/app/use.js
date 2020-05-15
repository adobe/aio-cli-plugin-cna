/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const BaseCommand = require('../../BaseCommand')
const { importConfigJson } = require('../../lib/import')
const { flags } = require('@oclif/command')
const inquirer = require('inquirer')
const config = require('@adobe/aio-lib-core-config')
const { EOL } = require('os')
const { getToken, context } = require('@adobe/aio-lib-ims')
const { CLI } = require('@adobe/aio-lib-ims/src/context')
const yeoman = require('yeoman-environment')
const env = yeoman.createEnv()

class Use extends BaseCommand {
  consoleConfigString (consoleConfig) {
    const { org = {}, project = {}, workspace = {} } = consoleConfig || {}
    const list = [
      `1. Org: ${org.name || '<no org selected>'}`,
      `2. Project: ${project.name || '<no project selected>'}`,
      `3. Workspace: ${workspace.name || '<no workspace selected>'}`
    ]
    const error = !consoleConfig || org === {} || project === {} || workspace === {}
    return { value: list.join(EOL), error }
  }

  async useConsoleConfig () {
    const consoleConfig = config.get('$console')
    const { value, error } = this.consoleConfigString(consoleConfig)
    if (error) {
      const message = `Your console configuration is incomplete.${EOL}Use the 'aio console' commands to select your organization, project, and workspace.${EOL}${value}`
      this.error(message)
    } else {
      const confirm = await inquirer.prompt([{
        type: 'confirm',
        name: 'res',
        message: `Do you want to use the current workspace?${EOL}${value}${EOL}`
      }])

      if (confirm.res) {
        const { org, project, workspace } = consoleConfig || {}
        const accessToken = await getToken(CLI)
        const { env: imsEnv = 'prod' } = await context.getCli() || {}

        const generatedFile = 'console.json'
        env.register(require.resolve('@adobe/generator-aio-console'), 'gen-console')
        await env.run('gen-console', {
          'destination-file': generatedFile,
          'access-token': accessToken,
          'ims-env': imsEnv,
          'org-id': org.id,
          'project-id': project.id,
          'workspace-id': workspace.id
        })

        return this.importConfigFile(generatedFile)
      }
    }
  }

  async importConfigFile (filePath) {
    const { flags } = this.parse(Use)

    const overwrite = flags.overwrite
    const merge = flags.merge
    let interactive = true

    if (overwrite || merge) {
      interactive = false
    }

    return importConfigJson(filePath, process.cwd(), { interactive, overwrite, merge })
  }

  async run () {
    const { args } = this.parse(Use)

    if (args.config_file_path) {
      return this.importConfigFile(args.config_file_path)
    } else {
      return this.useConsoleConfig()
    }
  }
}

Use.description = `Import an Adobe I/O Developer Console configuration file
`

Use.flags = {
  ...BaseCommand.flags,
  overwrite: flags.boolean({
    description: 'Overwrite any .aio and .env files during import of the Adobe I/O Developer Console configuration file',
    char: 'w',
    default: false
  }),
  merge: flags.boolean({
    description: 'Merge any .aio and .env files during import of the Adobe I/O Developer Console configuration file',
    char: 'm',
    default: false
  })
}

Use.args = [
  {
    name: 'config_file_path',
    description: 'path to an Adobe I/O Developer Console configuration file',
    required: false
  }
]

module.exports = Use
