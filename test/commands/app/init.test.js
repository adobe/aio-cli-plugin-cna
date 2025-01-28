/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const fs = require('fs-extra')
const path = require('path')
const TheCommand = require('../../../src/commands/app/init')
const BaseCommand = require('../../../src/BaseCommand')
const importHelperLib = require('../../../src/lib/import-helper')
const inquirer = require('inquirer')
const savedDataDir = process.env.XDG_DATA_HOME
const yeoman = require('yeoman-environment')
const { Octokit } = require('@octokit/rest')

jest.mock('@adobe/aio-lib-core-config')
jest.mock('fs-extra')
jest.mock('../../../src/lib/import-helper')
jest.mock('inquirer', () => ({
  registerPrompt: jest.fn(),
  prompt: jest.fn(),
  createPromptModule: jest.fn()
}))

// mock ora
jest.mock('ora', () => {
  const mockOra = {
    start: jest.fn(() => mockOra),
    stop: jest.fn(() => mockOra),
    succeed: jest.fn(() => mockOra),
    fail: jest.fn(() => mockOra),
    info: jest.fn(() => mockOra),
    warn: jest.fn(() => mockOra),
    stopAndPersist: jest.fn(() => mockOra),
    clear: jest.fn(() => mockOra),
    promise: jest.fn(() => Promise.resolve(mockOra))
  }
  return jest.fn(() => mockOra)
})

// mock login
jest.mock('@adobe/aio-lib-ims')

// mock console calls
jest.mock('@adobe/aio-cli-lib-console')
const LibConsoleCLI = require('@adobe/aio-cli-lib-console')
const mockConsoleCLIInstance = {
  getEnabledServicesForOrg: jest.fn(),
  promptForSelectOrganization: jest.fn(),
  getOrganizations: jest.fn(),
  getProjects: jest.fn(),
  promptForSelectProject: jest.fn(),
  promptForCreateProjectDetails: jest.fn(),
  createProject: jest.fn(),
  getWorkspaces: jest.fn(),
  promptForSelectWorkspace: jest.fn(),
  getServicePropertiesFromWorkspace: jest.fn(),
  subscribeToServices: jest.fn(),
  getWorkspaceConfig: jest.fn(),
  createWorkspace: jest.fn(),
  checkDevTermsForOrg: jest.fn(),
  getDevTermsForOrg: jest.fn(),
  acceptDevTermsForOrg: jest.fn(),
  prompt: {
    promptConfirm: jest.fn()
  }
}
LibConsoleCLI.init.mockResolvedValue(mockConsoleCLIInstance)
/** @private */
function resetMockConsoleCLI () {
  Object.keys(mockConsoleCLIInstance).forEach(k => {
    if ('mockReset' in mockConsoleCLIInstance[k]) {
      mockConsoleCLIInstance[k].mockReset()
    }
  })
  LibConsoleCLI.init.mockClear()
  mockConsoleCLIInstance.prompt.promptConfirm.mockReset()
}

jest.mock('yeoman-environment')
yeoman.createEnv.mockReturnValue({
  instantiate: jest.fn(),
  runGenerator: jest.fn()
})

jest.mock('@octokit/rest')

// FAKE DATA ///////////////////////

// // some fake data
const fakeSupportedOrgServices = [{ code: 'AssetComputeSDK', properties: {} }, { code: 'another', properties: {} }]
const fakeProject = { id: 'fakeprojid', name: 'bestproject', title: 'best project' }
const fakeOrg = { id: 'fakeorgid', name: 'bestorg' }
const fakeWorkspaces = [{ id: 'fakewspcid1', name: 'Stage' }, { id: 'fkewspcid2', name: 'dev' }]
const fakeServicePropertiesNoAssetCompute = [{ sdkCode: 'another' }]

// fake imported config
const fakeConfig = {
  project: {
    name: 'hola',
    title: 'hola world',
    org: { name: 'bestorg' },
    workspace: {
      details: {
        credentials: [
          {
            jwt: {
              client_id: 'fakeclientid'
            }
          }
        ]
      }
    }
  }
}
// ///////////////////////

// mock cwd
let fakeCwd
const savedChdir = process.chdir
const savedCwd = process.cwd

afterAll(() => {
  process.chdir = savedChdir
  process.cwd = savedCwd
})

let command

beforeEach(() => {
  fakeCwd = 'cwd'
  process.chdir = jest.fn().mockImplementation(dir => { fakeCwd = dir })
  process.cwd = jest.fn().mockImplementation(() => fakeCwd)
  process.chdir.mockClear()
  process.cwd.mockClear()

  command = new TheCommand([])
  command.config = {
    findCommand: jest.fn(() => ({})),
    runHook: jest.fn()
  }

  command.selectTemplates = jest.fn()
  command.selectTemplates.mockResolvedValue([])
  command.installTemplates = jest.fn()
  command.getTemplatesByExtensionPointIds = jest.fn()
  command.runInstallPackages = jest.fn()

  inquirer.prompt.mockResolvedValue({
    components: 'allTemplates'
  })

  resetMockConsoleCLI()
  mockConsoleCLIInstance.promptForSelectOrganization.mockResolvedValue({ id: 'my-org' })
  mockConsoleCLIInstance.getDevTermsForOrg.mockResolvedValue({ text: 'These are the Dev Terms.' })
  mockConsoleCLIInstance.checkDevTermsForOrg.mockResolvedValue(true)
  mockConsoleCLIInstance.createProject.mockResolvedValue({})
  mockConsoleCLIInstance.getWorkspaces.mockResolvedValue([{ name: 'Stage' }, { name: 'Production' }])
  mockConsoleCLIInstance.getWorkspaceConfig.mockResolvedValue({
    project: {
      name: 'my-project',
      workspace: {
        details: {
          credentials: [
          ]
        }
      }
    }
  })

  fs.ensureDirSync.mockClear()
  fs.unlinkSync.mockClear()
  // set config.dataDir in oclif
  process.env.XDG_DATA_HOME = 'data-dir'

  // default
  importHelperLib.loadAndValidateConfigFile.mockReset()
  importHelperLib.loadConfigFile.mockReset()
  importHelperLib.getServiceApiKey.mockReset()
  importHelperLib.importConfigJson.mockReset()

  importHelperLib.loadConfigFile.mockReturnValue({ values: fakeConfig })

  Octokit.mockReset()
})

afterAll(() => {
  process.env.XDG_DATA_HOME = savedDataDir
})

describe('Command Prototype', () => {
  test('exports', async () => {
    expect(typeof TheCommand).toEqual('function')
    expect(TheCommand.prototype instanceof BaseCommand).toBeTruthy()
    expect(typeof TheCommand.flags).toBe('object')
  })

  test('flags', async () => {
    expect(TheCommand.flags).toEqual(expect.objectContaining(BaseCommand.flags))

    expect(typeof TheCommand.flags.yes).toBe('object')
    expect(TheCommand.flags.yes.char).toBe('y')
    expect(TheCommand.flags.yes.default).toBe(false)

    expect(typeof TheCommand.flags.import).toBe('object')
    expect(TheCommand.flags.import.char).toBe('i')

    expect(TheCommand.flags.login.allowNo).toBe(true)
    expect(TheCommand.flags.login.default).toBe(true)

    expect(TheCommand.flags['standalone-app'].type).toBe('boolean')
    expect(TheCommand.flags['standalone-app'].default).toBe(false)

    expect(TheCommand.flags.template.multiple).toBe(true)
    expect(TheCommand.flags.template.char).toBe('t')
    expect(TheCommand.flags.template.type).toEqual('option')

    expect(TheCommand.flags.workspace.default).toBe('Stage')
    expect(TheCommand.flags.workspace.char).toBe('w')
    expect(TheCommand.flags.workspace.exclusive).toEqual(['import'])

    expect(TheCommand.flags['confirm-new-workspace'].type).toBe('boolean')
    expect(TheCommand.flags['confirm-new-workspace'].default).toBe(true)
  })

  test('args', async () => {
    expect(TheCommand.args).toEqual(expect.objectContaining({
      path: {
        description: 'Path to the app directory',
        default: '.',
        input: [],
        parse: expect.any(Function),
        type: 'option'
      }
    }))
  })
})

describe('bad args/flags', () => {
  test('unknown', async () => {
    command.argv = ['--wtf', 'dev'] // TODO: oclif bug: if no arg is set, an invalid flag does not fail
    await expect(command.run()).rejects.toThrow('Nonexistent flag')
  })
  test('--no-login and --workspace', async () => {
    command.argv = ['--no-login', '--workspace', 'dev']
    await expect(command.run()).rejects.toThrow('--no-login and --workspace flags cannot be used together.')
  })
})

describe('--project', () => {
  test('no value', async () => {
    command.argv = ['--project']
    await expect(command.run()).rejects.toThrow('Flag --project expects a value')
  })
  test('non-existent', async () => {
    command.argv = ['--project=non-existent']
    await expect(command.run()).rejects.toThrow('--project non-existent not found')
  })
})

describe('--no-login', () => {
  test('select excshell, arg: /otherdir', async () => {
    const installOptions = {
      useDefaultValues: false,
      installNpm: true,
      installConfig: false,
      templates: ['@adobe/my-extension']
    }
    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])

    command.argv = ['--no-login', '/otherdir']
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()

    expect(fs.ensureDirSync).toHaveBeenCalledWith(path.resolve('/otherdir'))
    expect(process.chdir).toHaveBeenCalledWith(path.resolve('/otherdir'))
  })

  test('select a template', async () => {
    const installOptions = {
      useDefaultValues: false,
      installNpm: true,
      installConfig: false,
      templates: ['@adobe/my-extension']
    }
    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])

    command.argv = ['--no-login']
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()
  })

  test('--standalone-app', async () => {
    command.runCodeGenerators = jest.fn()
    const installOptions = {
      useDefaultValues: false,
      installNpm: true,
      installConfig: false,
      templates: [] // stand-alone, we use the initial generators only, nothing to install from Template Registry
    }

    command.argv = ['--no-login', '--standalone-app']
    await command.run()

    expect(command.config.runHook).not.toHaveBeenCalled()
    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(command.runCodeGenerators).toHaveBeenCalledWith(['base-app', 'add-ci', 'add-vscode-config', 'application'], false, 'cwd', 'basic')
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()
  })

  test('--repo --no-login', async () => {
    const getContent = () => new Promise((resolve, reject) => {
      resolve({ headers: [], status: 302, data: [] })
    })
    Octokit.mockImplementation(() => ({ repos: { getContent } }))

    command.argv = ['--no-login', '--repo=adobe/appbuilder-quickstarts/qr-code']
    await command.run()

    expect(command.config.runHook).toHaveBeenCalled()
    expect(command.installTemplates).not.toHaveBeenCalled()
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()
  })

  test('--repo --login', async () => {
    const getContent = ({ owner, repo, path }) => new Promise((resolve, reject) => {
      // console.log('args = ', owner, repo, path)
      if (path === 'src') {
        resolve({ data: [] })
      } else {
        resolve({
          data: [{
            type: 'file',
            path: '.gitignore',
            download_url: 'https://raw.githubusercontent.com/adobe/appbuilder-quickstarts/master/qr-code/.gitignore'
          }, {
            type: 'dir',
            path: 'src'
          }]
        })
      }
    })
    Octokit.mockImplementation(() => ({ repos: { getContent } }))

    command.argv = ['--login', '--repo=adobe/appbuilder-quickstarts/qr-code']
    await command.run()

    expect(command.config.runHook).toHaveBeenCalled()
    expect(command.installTemplates).not.toHaveBeenCalled()
    expect(LibConsoleCLI.init).toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).toHaveBeenCalled()
  })

  test('--repo not valid 404', async () => {
    const getContent = () => new Promise((resolve, reject) => {
      // console.log('rejecting with 404')
      const error = new Error('the error message is not checked, just the status code')
      error.status = 404
      reject(error)
    })
    Octokit.mockImplementation(() => ({ repos: { getContent } }))

    command.error = jest.fn()
    command.argv = ['--no-login', '--repo=adobe/appbuilder-quickstarts/dne']

    await command.run()

    expect(command.config.runHook).toHaveBeenCalled()
    expect(command.error).toHaveBeenCalledWith('--repo does not point to a valid Adobe App Builder app')
    expect(command.installTemplates).not.toHaveBeenCalled()
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()
  })

  test('--repo not reachable 403', async () => {
    const getContent = () => new Promise((resolve, reject) => {
      // console.log('rejecting with 403')
      const error = new Error('the error message is not checked, just the status code')
      error.response = { headers: { 'x-ratelimit-reset': 99999999999 } }
      error.status = 403
      reject(error)
    })
    Octokit.mockImplementation(() => ({ repos: { getContent } }))

    command.error = jest.fn()
    command.argv = ['--no-login', '--repo=adobe/appbuilder-quickstarts/dne']

    await command.run()

    expect(command.error).toHaveBeenCalledWith('too many requests, please try again later')
    expect(command.installTemplates).not.toHaveBeenCalled()
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()
  })

  test('--yes --no-install, select excshell', async () => {
    const installOptions = {
      useDefaultValues: true,
      installNpm: false,
      installConfig: false,
      templates: ['@adobe/my-extension']
    }
    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])

    command.argv = ['--no-login', '--yes', '--no-install']
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()
  })

  test('--yes --no-install, --template @adobe/my-extension', async () => {
    const installOptions = {
      useDefaultValues: true,
      installNpm: false,
      installConfig: false,
      templates: ['@adobe/my-extension']
    }

    command.argv = ['--no-login', '--yes', '--no-install', '--template', '@adobe/my-extension']
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()
  })

  test('--yes --no-install, --template @adobe/my-extension --template @adobe/your-extension', async () => {
    const installOptions = {
      useDefaultValues: true,
      installNpm: false,
      installConfig: false,
      templates: ['@adobe/my-extension', '@adobe/your-extension']
    }

    command.argv = ['--no-login', '--yes', '--no-install', '--template', '@adobe/my-extension', '--template', '@adobe/your-extension']
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()
  })

  test('--yes --no-login --linter=none', async () => {
    command.runCodeGenerators = jest.fn()
    const installOptions = {
      useDefaultValues: true,
      installNpm: true,
      installConfig: false,
      templates: []
    }

    command.argv = ['--yes', '--no-login', '--linter=none']
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(command.runCodeGenerators).toHaveBeenCalledWith(['base-app', 'add-ci', 'add-vscode-config', 'application'], true, 'cwd', 'none')
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()
  })

  test('--yes --no-login --linter=adobe-recommended', async () => {
    command.runCodeGenerators = jest.fn()
    const installOptions = {
      useDefaultValues: true,
      installNpm: true,
      installConfig: false,
      templates: []
    }

    command.argv = ['--yes', '--no-login', '--linter=adobe-recommended']
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(command.runCodeGenerators).toHaveBeenCalledWith(['base-app', 'add-ci', 'add-vscode-config', 'application'], true, 'cwd', 'adobe-recommended')
    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).not.toHaveBeenCalled()
  })

  test('--yes --no-login --linter=invalid', async () => {
    command.runCodeGenerators = jest.fn()
    command.argv = ['--yes', '--no-login', '--linter=invalid']
    await expect(command.run()).rejects.toThrow('Expected --linter=invalid to be one of: none, basic, adobe-recommended\nSee more help with --help')
  })
})

describe('--login', () => {
  test('--standalone-app', async () => {
    const installOptions = {
      useDefaultValues: false,
      installNpm: true,
      templates: [] // stand-alone, we use the initial generators only, nothing to install from Template Registry
    }

    command.argv = ['--standalone-app']
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).toHaveBeenCalled()
  })

  test('--yes --no-install, --template @adobe/my-extension --template @adobe/your-extension', async () => {
    const installOptions = {
      useDefaultValues: true,
      installNpm: false,
      templates: ['@adobe/my-extension', '@adobe/your-extension']
    }

    command.argv = ['--yes', '--no-install', '--template', '@adobe/my-extension', '--template', '@adobe/your-extension']
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).toHaveBeenCalled()
  })

  test('--import fakeconfig.json', async () => {
    importHelperLib.loadAndValidateConfigFile.mockReturnValue({ values: fakeConfig })
    importHelperLib.getServiceApiKey.mockReturnValue('fakeclientid')

    command.argv = ['--import', 'fakeconfig.json']
    await command.run()

    expect(LibConsoleCLI.init).not.toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).toHaveBeenCalledWith(
      Buffer.from(JSON.stringify(fakeConfig)),
      'cwd',
      { interactive: false, merge: true, overwrite: undefined, useJwt: false },
      { SERVICE_API_KEY: 'fakeclientid' }
    )
  })

  test('select template, -w dev', async () => {
    const installOptions = {
      useDefaultValues: false,
      installNpm: true,
      templates: ['@adobe/my-extension']
    }
    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])
    inquirer.prompt.mockResolvedValue({
      components: 'orgTemplates'
    })

    mockConsoleCLIInstance.getEnabledServicesForOrg.mockResolvedValue(fakeSupportedOrgServices)
    mockConsoleCLIInstance.getWorkspaceConfig.mockResolvedValue(fakeConfig)
    mockConsoleCLIInstance.getWorkspaces.mockResolvedValue(fakeWorkspaces)
    mockConsoleCLIInstance.promptForSelectOrganization.mockResolvedValue(fakeOrg)
    mockConsoleCLIInstance.promptForSelectProject.mockResolvedValue(fakeProject)

    command.argv = ['-w', 'dev']
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).toHaveBeenCalled()
    expect(mockConsoleCLIInstance.getWorkspaceConfig).toHaveBeenCalledWith(fakeOrg.id, fakeProject.id, fakeWorkspaces[1].id, fakeSupportedOrgServices)
    expect(mockConsoleCLIInstance.createProject).not.toHaveBeenCalled()
  })

  test('select template, -w notexists, promptConfirm true', async () => {
    mockConsoleCLIInstance.checkDevTermsForOrg.mockResolvedValue(true)
    mockConsoleCLIInstance.prompt.promptConfirm.mockResolvedValue(true)
    mockConsoleCLIInstance.promptForSelectOrganization.mockResolvedValue(fakeOrg)
    mockConsoleCLIInstance.promptForSelectProject.mockResolvedValue(fakeProject)
    mockConsoleCLIInstance.getWorkspaces.mockResolvedValue(fakeWorkspaces)
    mockConsoleCLIInstance.getServicePropertiesFromWorkspace.mockResolvedValue(fakeServicePropertiesNoAssetCompute)
    mockConsoleCLIInstance.getEnabledServicesForOrg.mockResolvedValue(fakeSupportedOrgServices)
    mockConsoleCLIInstance.getWorkspaceConfig.mockResolvedValue(fakeConfig)
    mockConsoleCLIInstance.createWorkspace.mockResolvedValue(fakeWorkspaces[0])

    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])

    command.argv = ['-w', 'notexists']
    await command.run()
    expect(mockConsoleCLIInstance.createWorkspace).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ name: 'notexists', title: '' }))
  })

  test('select template, -w notexists, --no-confirm-new-workspace (no confirm, create workspace)', async () => {
    const workspaceName = 'notexists'
    mockConsoleCLIInstance.checkDevTermsForOrg.mockResolvedValue(true)
    mockConsoleCLIInstance.prompt.promptConfirm.mockResolvedValue(false)
    mockConsoleCLIInstance.promptForSelectOrganization.mockResolvedValue(fakeOrg)
    mockConsoleCLIInstance.promptForSelectProject.mockResolvedValue(fakeProject)
    mockConsoleCLIInstance.getWorkspaces.mockResolvedValue(fakeWorkspaces)
    mockConsoleCLIInstance.getServicePropertiesFromWorkspace.mockResolvedValue(fakeServicePropertiesNoAssetCompute)
    mockConsoleCLIInstance.getEnabledServicesForOrg.mockResolvedValue(fakeSupportedOrgServices)
    mockConsoleCLIInstance.getWorkspaceConfig.mockResolvedValue(fakeConfig)
    mockConsoleCLIInstance.createWorkspace.mockResolvedValue(fakeWorkspaces[0])

    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])

    command.argv = ['-w', workspaceName, '--no-confirm-new-workspace']
    await expect(command.run()).resolves.not.toThrow()
    expect(mockConsoleCLIInstance.prompt.promptConfirm).not.toHaveBeenCalled()
    expect(mockConsoleCLIInstance.createWorkspace).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ name: workspaceName, title: '' }))
  })

  test('select template, -w notexists, --confirm-new-workspace (confirm result: false, throws error)', async () => {
    const workspaceName = 'notexists'
    mockConsoleCLIInstance.checkDevTermsForOrg.mockResolvedValue(true)
    mockConsoleCLIInstance.prompt.promptConfirm.mockResolvedValue(false)
    mockConsoleCLIInstance.promptForSelectOrganization.mockResolvedValue(fakeOrg)
    mockConsoleCLIInstance.promptForSelectProject.mockResolvedValue(fakeProject)
    mockConsoleCLIInstance.getWorkspaces.mockResolvedValue(fakeWorkspaces)
    mockConsoleCLIInstance.getServicePropertiesFromWorkspace.mockResolvedValue(fakeServicePropertiesNoAssetCompute)
    mockConsoleCLIInstance.getEnabledServicesForOrg.mockResolvedValue(fakeSupportedOrgServices)
    mockConsoleCLIInstance.getWorkspaceConfig.mockResolvedValue(fakeConfig)
    mockConsoleCLIInstance.createWorkspace.mockResolvedValue(fakeWorkspaces[0])

    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])

    command.argv = ['-w', workspaceName, '--confirm-new-workspace']
    await expect(command.run()).rejects.toThrow(`Workspace '${workspaceName}' does not exist and creation aborted`)
    expect(mockConsoleCLIInstance.prompt.promptConfirm).toHaveBeenCalled()
    expect(mockConsoleCLIInstance.createWorkspace).not.toHaveBeenCalled()
  })

  test('select template, -w notexists, --confirm-new-workspace (confirm result: true, create workspace)', async () => {
    const workspaceName = 'notexists'
    mockConsoleCLIInstance.checkDevTermsForOrg.mockResolvedValue(true)
    mockConsoleCLIInstance.prompt.promptConfirm.mockResolvedValue(true)
    mockConsoleCLIInstance.promptForSelectOrganization.mockResolvedValue(fakeOrg)
    mockConsoleCLIInstance.promptForSelectProject.mockResolvedValue(fakeProject)
    mockConsoleCLIInstance.getWorkspaces.mockResolvedValue(fakeWorkspaces)
    mockConsoleCLIInstance.getServicePropertiesFromWorkspace.mockResolvedValue(fakeServicePropertiesNoAssetCompute)
    mockConsoleCLIInstance.getEnabledServicesForOrg.mockResolvedValue(fakeSupportedOrgServices)
    mockConsoleCLIInstance.getWorkspaceConfig.mockResolvedValue(fakeConfig)
    mockConsoleCLIInstance.createWorkspace.mockResolvedValue(fakeWorkspaces[0])

    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])

    command.argv = ['-w', workspaceName, '--confirm-new-workspace']
    await expect(command.run()).resolves.not.toThrow()
    expect(mockConsoleCLIInstance.prompt.promptConfirm).toHaveBeenCalled()
    expect(mockConsoleCLIInstance.createWorkspace).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ name: workspaceName, title: '' }))
  })

  test('--extension dx/excshell/1 --extension dx/something/1 (found)', async () => {
    const extensionPointIds = ['dx/excshell/1', 'dx/something/1']
    command.argv = ['--extension', extensionPointIds[0], '--extension', extensionPointIds[1]]
    command.getTemplatesByExtensionPointIds.mockResolvedValue({
      found: extensionPointIds,
      notFound: [],
      templates: [
        { name: '@adobe/myrepo1' },
        { name: '@adobe/myrepo2' }
      ]
    })

    const installOptions = {
      installNpm: true,
      templates: ['@adobe/myrepo1', '@adobe/myrepo2'],
      useDefaultValues: false
    }

    await command.run()
    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
  })

  test('--extension foo/bar/1 --extension bar/baz/1 (not found)', async () => {
    const extensionPointIds = ['foo/bar/1', 'bar/baz/1']
    command.argv = ['--extension', extensionPointIds[0], '--extension', extensionPointIds[1]]
    command.getTemplatesByExtensionPointIds.mockResolvedValue({
      found: [],
      notFound: extensionPointIds,
      templates: []
    })
    await expect(command.run()).rejects.toThrow(`Extension(s) '${extensionPointIds.join(', ')}' not found in the Template Registry.`)
  })
})

describe('no args', () => {
  test('select a template (all templates)', async () => {
    const installOptions = {
      useDefaultValues: false,
      installNpm: true,
      templates: ['@adobe/my-extension']
    }
    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])
    inquirer.prompt.mockResolvedValue({
      components: 'allTemplates'
    })
    const fakeSupportedOrgServices = [{ code: 'AssetComputeSDK', properties: {} }, { code: 'another', properties: {} }]
    mockConsoleCLIInstance.getEnabledServicesForOrg.mockResolvedValue(fakeSupportedOrgServices)

    command.argv = []
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).toHaveBeenCalled()
  })

  test('select a template (all extensions)', async () => {
    const installOptions = {
      useDefaultValues: false,
      installNpm: true,
      templates: ['@adobe/my-extension']
    }
    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])
    inquirer.prompt.mockResolvedValue({
      components: 'allExtensionPoints'
    })
    const fakeSupportedOrgServices = [{ code: 'AssetComputeSDK', properties: {} }, { code: 'another', properties: {} }]
    mockConsoleCLIInstance.getEnabledServicesForOrg.mockResolvedValue(fakeSupportedOrgServices)

    command.argv = []
    await command.run()

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).toHaveBeenCalled()
  })

  test('select a template (org templates)', async () => {
    const installOptions = {
      useDefaultValues: false,
      installNpm: true,
      templates: ['@adobe/my-extension']
    }
    command.selectTemplates.mockResolvedValue(['@adobe/my-extension'])
    inquirer.prompt.mockResolvedValue({
      components: 'orgTemplates'
    })

    const fakeSupportedOrgServices = [
      { code: 'AssetComputeSDK', properties: {} },
      { code: 'AnotherSDK', properties: {} },
      { code: 'YetAnotherSDK', properties: {} }
    ]
    mockConsoleCLIInstance.getEnabledServicesForOrg.mockResolvedValue(fakeSupportedOrgServices)

    command.argv = []
    await command.run()

    const searchCriteria = command.selectTemplates.mock.calls[0][0] // first arg of first call
    expect(searchCriteria).toEqual(
      {
        apis: [
          'AssetComputeSDK', // | symbol denotes an OR clause (only if it's not the first item)
          '|AnotherSDK',
          '|YetAnotherSDK'
        ],
        categories: '!helper-template',
        statuses: 'Approved'
      }
    )

    expect(command.installTemplates).toHaveBeenCalledWith(installOptions)
    expect(LibConsoleCLI.init).toHaveBeenCalled()
    expect(importHelperLib.importConfigJson).toHaveBeenCalled()
  })

  test('templates plugin is not installed', async () => {
    command.config.findCommand.mockResolvedValue(null)
    await expect(command.run()).rejects.toThrow('aio-cli plugin @adobe/aio-cli-plugin-app-templates was not found. This plugin is required to install templates.')
  })
})

describe('dev terms', () => {
  test('not accepted', async () => {
    mockConsoleCLIInstance.checkDevTermsForOrg.mockResolvedValue(false)
    mockConsoleCLIInstance.prompt.promptConfirm.mockResolvedValue(false)
    await expect(command.run()).rejects.toThrow('The Developer Terms of Service were declined')
  })

  test('accepted (check was successful)', async () => {
    mockConsoleCLIInstance.checkDevTermsForOrg.mockResolvedValue(true)
    await expect(command.run()).resolves.toBeUndefined()
  })

  test('accepted (check was unsuccessful, prompt to confirm acceptance, confirmed acceptance on the server)', async () => {
    mockConsoleCLIInstance.checkDevTermsForOrg.mockResolvedValue(false)
    mockConsoleCLIInstance.prompt.promptConfirm.mockResolvedValue(true)
    mockConsoleCLIInstance.acceptDevTermsForOrg.mockResolvedValue(true)

    await expect(command.run()).resolves.toBeUndefined()
  })

  test('accepted (check was unsuccessful, prompt to confirm acceptance, unconfirmed acceptance on the server)', async () => {
    mockConsoleCLIInstance.checkDevTermsForOrg.mockResolvedValue(false)
    mockConsoleCLIInstance.prompt.promptConfirm.mockResolvedValue(true)
    mockConsoleCLIInstance.acceptDevTermsForOrg.mockResolvedValue(false)

    await expect(command.run()).rejects.toThrow('The Developer Terms of Service could not be accepted')
  })
})
