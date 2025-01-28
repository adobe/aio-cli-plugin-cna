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

const AddCommand = require('./AddCommand')
const aioLogger = require('@adobe/aio-lib-core-logging')('@adobe/aio-cli-plugin-app:TemplatesCommand', { provider: 'debug' })
const inquirerTableCheckbox = require('@adobe/inquirer-table-checkbox')
const inquirer = require('inquirer')
const TemplateRegistryAPI = require('@adobe/aio-lib-templates')
const hyperlinker = require('hyperlinker')
const ora = require('ora')
const terminalSize = require('term-size')

class TemplatesCommand extends AddCommand {
  /**
   * Gets a list of templates from the Template Registry API using the criteria provided.
   *
   * @param {object} searchCriteria the Template Registry API search criteria
   * @param {object} orderByCriteria the Template Registry API orderBy criteria
   * @param {object} [templateRegistryConfig={}] the optional Template Registry API config
   * @returns {Array<object>} list of templates
   */
  async getTemplates (searchCriteria, orderByCriteria, templateRegistryConfig = {}) {
    const templateRegistryClient = TemplateRegistryAPI.init(templateRegistryConfig)
    const templateList = []

    const templatesIterator = templateRegistryClient.getTemplates(searchCriteria, orderByCriteria)

    for await (const templates of templatesIterator) {
      for (const template of templates) {
        templateList.push(template)
      }
    }
    aioLogger.debug('template list', JSON.stringify(templateList, null, 2))

    return templateList
  }

  /**
   * Select templates from the Template Registry API, via a cli table.
   *
   * @param {object} searchCriteria the Template Registry API search criteria
   * @param {object} orderByCriteria the Template Registry API orderBy criteria
   * @param {Array<object>} orgSupportedServices Services supported by the org
   * @param {object} [templateRegistryConfig={}] the optional Template Registry API config
   * @returns {Array<string>} an array of selected template module name(s)
   */
  async selectTemplates (searchCriteria, orderByCriteria, orgSupportedServices = undefined, templateRegistryConfig = {}) {
    aioLogger.debug(`searchCriteria ${JSON.stringify(searchCriteria, null, 2)}`)
    aioLogger.debug(`orderByCriteria ${JSON.stringify(orderByCriteria, null, 2)}`)
    let supportedServiceCodes
    if (orgSupportedServices) {
      supportedServiceCodes = new Set(orgSupportedServices.map(s => s.code))
    }
    aioLogger.debug(`supportedServiceCodes ${JSON.stringify(supportedServiceCodes, null, 2)}`)

    const spinner = ora()
    spinner.start('Getting available templates')

    const templateList = await this.getTemplates(searchCriteria, orderByCriteria, templateRegistryConfig)
    aioLogger.debug(`templateList ${JSON.stringify(templateList, null, 2)}`)
    spinner.succeed('Downloaded the list of templates')

    if (templateList.length === 0) {
      throw new Error('There are no templates that match the query for selection')
    }

    const { columns: terminalColumns } = terminalSize()

    const colPadding = 3
    const colWidths = [
      Math.round(0.3 * terminalColumns) - colPadding,
      Math.round(0.3 * terminalColumns) - colPadding,
      Math.round(0.2 * terminalColumns) - colPadding,
      Math.round(0.2 * terminalColumns) - colPadding]

    const COLUMNS = {
      COL_TEMPLATE: 'Template',
      COL_DESCRIPTION: 'Description',
      COL_EXTENSION_POINT: 'Extension Point',
      COL_CATEGORIES: 'Categories'
    }

    const rows = templateList.map(template => {
      const extensionPoint = template.extensions ? template.extensions.map(ext => ext.extensionPointId).join(',') : 'N/A'
      const name = template.adobeRecommended ? `${template.name} *` : template.name
      let disabled = false
      if (template.apis && supportedServiceCodes) {
        disabled = !template.apis.map(api => api.code).every(code => supportedServiceCodes.has(code))
      }
      return {
        value: template.name,
        disabled,
        [COLUMNS.COL_TEMPLATE]: name,
        [COLUMNS.COL_DESCRIPTION]: template.description,
        [COLUMNS.COL_EXTENSION_POINT]: extensionPoint,
        [COLUMNS.COL_CATEGORIES]: template?.categories?.join(', ')
      }
    })
    const promptName = 'select template'

    inquirer.registerPrompt('table', inquirerTableCheckbox)
    const answers = await inquirer
      .prompt([
        {
          type: 'table',
          name: promptName,
          bottomContent: `* = recommended by Adobe; to learn more about the templates, go to ${hyperlinker('https://adobe.ly/templates', 'https://adobe.ly/templates')}`,
          message: 'Press spacebar to choose the template(s) to install:\n  Pressing <enter> without selection will skip templates and install a standalone application.\n',
          style: { head: [], border: [] },
          wordWrap: true,
          wrapOnWordBoundary: false,
          colWidths,
          columns: [
            { name: COLUMNS.COL_TEMPLATE },
            { name: COLUMNS.COL_DESCRIPTION, wrapOnWordBoundary: true },
            { name: COLUMNS.COL_EXTENSION_POINT },
            { name: COLUMNS.COL_CATEGORIES, wrapOnWordBoundary: false }
          ],
          rows
        }
      ])

    return answers[promptName]
  }

  /**
   * Install the templates.
   *
   * @param {object} templateData the template data
   * @param {boolean} [templateData.useDefaultValues=false] use default values when installing the template
   * @param {boolean} [templateData.installConfig=true] process the install.yml of the template
   * @param {boolean} [templateData.installNpm=true] run npm install after installing the template
   * @param {object} [templateData.templateOptions=null] set the template options for installation
   * @param {Array} templateData.templates the list of templates to install
   */
  async installTemplates ({
    useDefaultValues = false,
    installConfig = true,
    installNpm = true,
    templateOptions = null,
    templates = []
  } = {}) {
    const spinner = ora()

    if (templates.length <= 0) {
      aioLogger.debug('installTemplates: standalone-app')
      // technically runHook can quietly fail, but we are choosing to ignore it as these are telemetry events
      // and not mission critical
      await this.config.runHook('telemetry', { data: 'installTemplates:standalone-app' })
    } else {
      aioLogger.debug(`installTemplates: ${templates}`)
      await this.config.runHook('telemetry', { data: `installTemplates:${templates}` })
    }

    // install the templates in sequence
    for (const template of templates) {
      spinner.info(`Installing template ${template}`)
      const installArgs = [template]
      if (useDefaultValues) {
        installArgs.push('--yes')
      }
      if (!installConfig) {
        installArgs.push('--no-process-install-config')
      }
      if (!installNpm) {
        installArgs.push('--no-install')
      }

      if (templateOptions) {
        if (typeof templateOptions !== 'object' || Array.isArray(templateOptions)) { // must be a non-array object
          aioLogger.debug('malformed templateOptions', templateOptions)
          throw new Error('The templateOptions is not a JavaScript object.')
        }
        const jsonString = JSON.stringify(templateOptions)
        installArgs.push(`--template-options=${Buffer.from(jsonString).toString('base64')}`)
      }

      await this.config.runCommand('templates:install', installArgs)
      spinner.succeed(`Installed template ${template}`)
    }
  }

  /** @private */
  _uniqueArray (array) {
    return Array.from(new Set(array))
  }

  /**
   * Get templates by extension point ids.
   *
   * @param {Array<string>} extensionsToInstall an array of extension point ids to install.
   * @param {object} [templateRegistryConfig={}] the optional Template Registry API config
   * @returns {object} returns the result
   */
  async getTemplatesByExtensionPointIds (extensionsToInstall, templateRegistryConfig = {}) {
    const orderByCriteria = {
      [TemplateRegistryAPI.ORDER_BY_CRITERIA_PUBLISH_DATE]: TemplateRegistryAPI.ORDER_BY_CRITERIA_SORT_DESC
    }

    const searchCriteria = {
      [TemplateRegistryAPI.SEARCH_CRITERIA_STATUSES]: TemplateRegistryAPI.TEMPLATE_STATUS_APPROVED,
      [TemplateRegistryAPI.SEARCH_CRITERIA_EXTENSIONS]: extensionsToInstall
    }

    const templates = await this.getTemplates(searchCriteria, orderByCriteria, templateRegistryConfig)
    aioLogger.debug('templateList', JSON.stringify(templates, null, 2))

    // check whether we got all extensions
    const found = this._uniqueArray(templates
      .map(t => t.extensions.map(e => e.extensionPointId)) // array of array of extensionPointIds
      .filter(ids => extensionsToInstall.some(item => ids.includes(item)))
      .flat()
    )

    const notFound = this._uniqueArray(extensionsToInstall).filter(ext => !found.includes(ext))

    return {
      found,
      notFound,
      templates
    }
  }

  /**
   * Install templates by extension point ids.
   *
   * @param {Array<string>} extensionsToInstall an array of extension point ids to install.
   * @param {Array<string>} extensionsAlreadyImplemented an array of extension point ids that have already been implemented (to filter)
   * @param {boolean} [useDefaultValues=false] use default values when installing the template
   * @param {boolean} [installNpm=true] run npm install after installing the template
   * @param {object} [templateRegistryConfig={}] the optional Template Registry API config
   */
  async installTemplatesByExtensionPointIds (extensionsToInstall, extensionsAlreadyImplemented, useDefaultValues = false, installNpm = true, templateRegistryConfig = {}) {
    // no prompt
    const alreadyThere = extensionsToInstall.filter(i => extensionsAlreadyImplemented.includes(i))
    if (alreadyThere.length > 0) {
      throw new Error(`'${alreadyThere.join(', ')}' extension(s) are already implemented in this project.`)
    }

    const { found, notFound, templates } = await this.getTemplatesByExtensionPointIds(extensionsToInstall, templateRegistryConfig)

    if (notFound.length > 0) {
      this.error(`Extension(s) '${notFound.join(', ')}' not found in the Template Registry.`)
    }

    this.log(`Extension(s) '${found.join(', ')}' found in the Template Registry. Installing...`)
    await this.installTemplates({
      useDefaultValues,
      installNpm,
      templates: templates.map(t => t.name)
    })
  }
}

TemplatesCommand.flags = {
  ...AddCommand.flags
}

module.exports = TemplatesCommand
