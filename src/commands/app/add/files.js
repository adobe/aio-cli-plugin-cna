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
const fs = require('fs')
const path = require('path')
const filesLib = require('@adobe/aio-lib-files')


const chalk = require('chalk')
const yaml = require('js-yaml')

/*
  This is a quick poc intended to add files to remote file storage, and display results in json, yaml or as a list.
  Possible future enhancements:
  - recursive add
  
*/

class AddFilesCommand extends BaseCommand {
  async run() {
    const { flags, args } = await this.parse(AddFilesCommand)
    aioLogger.debug(`Add files with flags: ${JSON.stringify(flags)}`)

    let value = args['value|filename']
    if (flags.file && !value) {
      this.error('Missing filename')
    }

    const extConfig = this.getAppExtConfigs(flags)

    const { namespace, auth } = Object.values(extConfig)[0]?.ow
    if (namespace && auth) {
      const files = await filesLib.init({ ow: { namespace, auth } })
      if (flags.file) {
        try {
          const resolvedPath = path.resolve(value)
          const fileContents = fs.readFileSync(resolvedPath, 'utf8')
          const results = await files.write(args.path, fileContents)
          this.log(`Added ${results.length} files in ${args.path}`)
          if (results.length > 0) {
            this.log(results.map(r => r.name).join('\n'))
          }
        } catch (e) {
          this.error(`Cannot read file: ${e.message + value}`)
        }
      } else {
        const results = await files.write(args.path, value)
        this.log(`Added ${results.length} files in ${args.path}`)
        if (results.length > 0) {
          this.log(results.map(r => r.name).join('\n'))
        }
      }

      
      

    } else {
      this.log('Missing config values, or current working directory is not an App Builder app.')
    }
  }
}

AddFilesCommand.description = `Add files in storage
`
AddFilesCommand.flags = {
  ...BaseCommand.flags,
  json: Flags.boolean({
    description: 'Output json',
    char: 'j'
  }),
  yml: Flags.boolean({
    description: 'Output yml',
    char: 'y'
  }),
  file: Flags.boolean({
    char: 'f',
    description: 'value is a path to a file'
  })
}

AddFilesCommand.aliases = ['app:add:files', 'app:files:add', 'app:add:file']
AddFilesCommand.args = [{
  name: 'path',
  description: 'Remote filepath to add',
  required: true
}, {
  name: 'value|filename',
  required: false
}]

module.exports = AddFilesCommand
