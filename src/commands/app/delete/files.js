/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const BaseCommand = require('../../../BaseCommand')

const aioLogger = require('@adobe/aio-lib-core-logging')('@adobe/aio-cli-plugin-app:list:extensions', { provider: 'debug' })
const { Flags } = require('@oclif/core')
const filesLib = require('@adobe/aio-lib-files')


const chalk = require('chalk')
const yaml = require('js-yaml')

/*
  This is a quick poc intended to delete files in remote storage, and display results in json, yaml or as a list.
  Possible future enhancements:
  - prompt before deleting 'Are you sure you want to delete these files?' (thanks co-pilot!)
*/

class DeleteFilesCommand extends BaseCommand {
  async run() {
    const { flags, args } = await this.parse(DeleteFilesCommand)
    aioLogger.debug(`Delete files with flags: ${JSON.stringify(flags)}`)

    const extConfig = this.getAppExtConfigs(flags)

    const { namespace, auth } = Object.values(extConfig)[0]?.ow
    if (namespace && auth) {
      const files = await filesLib.init({ ow: { namespace, auth } })
      const results = await files.delete(args.path)
      this.log(`Deleted ${results.length} files in ${args.path}`)
      if (results.length > 0) {
        this.log(results.map(r => r.name).join('\n'))
      }
    } else {
      this.log('Missing config values, or current working directory is not an App Builder app.')
    }
  }
}

DeleteFilesCommand.description = `Delete files in storage
`
DeleteFilesCommand.flags = {
  ...BaseCommand.flags,
  json: Flags.boolean({
    description: 'Output json',
    char: 'j'
  }),
  yml: Flags.boolean({
    description: 'Output yml',
    char: 'y'
  })
}

DeleteFilesCommand.aliases = ['app:delete:files', 'app:files:delete', 'app:delete:file', 'app:files:rm', 'app:files:remove']
DeleteFilesCommand.args = [
  {
    name: 'path',
    description: 'Remote filepath to delete',
    required: true
  }
]

module.exports = DeleteFilesCommand
