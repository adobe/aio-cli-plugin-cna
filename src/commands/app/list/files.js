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
  This is a quick poc intended to list files in remote storage, and display results in json, yaml or as a list.
  Possible future enhancements:
  - allow wildcards in path, e.g. `aio app list files /my/path/*.json`
  - allow filtering by file type, e.g. `aio app list files --type=html`
  - display file size in human readable format, e.g. 1.2MB
  - allow sorting by name, size, date, etc.
  - allow pagination ( thanks co-pilot you were on a roll!)
  - display file permissions, modifiedDate, etc.
  - display as tree, or table, remove args.path from file names
  - display overall storage usage, number of private/public files, and overall size
  - aio app add files <path> <file> to upload a file|folder
  - aio app delete files <path> <file> to delete a file|folder
*/

class ListFilesCommand extends BaseCommand {
  async run() {
    const { flags, args } = await this.parse(ListFilesCommand)
    aioLogger.debug(`list files with flags: ${JSON.stringify(flags)}`)

    const extConfig = this.getAppExtConfigs(flags)

    const {namespace, auth} = Object.values(extConfig)[0]?.ow
    if (namespace && auth) {
      const files = await filesLib.init({ ow: { namespace, auth } })
      const filesList = await files.list(args.path)
      // print
      if (flags.json) {
        this.log(JSON.stringify(filesList, 0, 2))
      } else if (flags.yml) {
        this.log(yaml.dump(filesList))
      } else {
        if (filesList.length > 0) {
          this.log(chalk.bold(`Files: ${args.path}`))
          filesList.forEach(fileInfo => {
            this.log(`${fileInfo.name} \t${fileInfo.contentType} \t${chalk.dim(`(${fileInfo.contentLength} bytes)`)}`)
          })
        } else {
          this.log('No files found')
        }
      }
    } else {
      this.log('Missing config values, or current working directory is not an App Builder app.')
    }
  }
}

ListFilesCommand.description = `List files in storage
`
ListFilesCommand.flags = {
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

ListFilesCommand.aliases = ['app:ls:files', 'app:files:list', 'app:files:ls', 'app:files']
ListFilesCommand.args = [
  {
    name: 'path',
    description: 'Remote path to list',
    default: '/'
  }
]

module.exports = ListFilesCommand
