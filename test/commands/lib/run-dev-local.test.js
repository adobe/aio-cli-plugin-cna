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

/* eslint jest/expect-expect: [
  "error",
  {
    "assertFunctionNames": [
        "expect", "testCleanupNoErrors", "testCleanupOnError", "expectUIServer", "failMissingRuntimeConfig"
    ]
  }
]
*/

const runDevLocal = require('../../../src/lib/run-dev-local')
const utils = require('../../../src/lib/app-helper')
const mockLogger = require('@adobe/aio-lib-core-logging')
const path = require('path')
const fs = require('fs-extra')

jest.mock('../../../src/lib/app-helper')
jest.mock('fs-extra')

const LOCAL_CONFIG = {
  root: '/my-app',
  envFile: '.my.env',
  app: {
    dist: 'dist'
  },
  cli: {
    dataDir: path.join('/', 'dataDir')
  }
}

// those must match the ones defined in dev.js
const OW_JAR_URL = 'https://bintray.com/api/ui/download/adobe/generic/openwhisk/standalone-v1/openwhisk-standalone.jar'
const OW_JAR_PATH = path.join(LOCAL_CONFIG.cli.dataDir, 'openwhisk', 'standalone-v1', 'openwhisk-standalone.jar')

beforeEach(() => {
  mockLogger.mockReset()

  utils.downloadOWJar.mockReset()
  utils.runOpenWhiskJar.mockReset()
  fs.existsSync.mockReset()
})

test('should fail if java is not installed', async () => {
  utils.hasJavaCLI.mockResolvedValueOnce(false)

  await expect(runDevLocal(LOCAL_CONFIG)).rejects.toEqual(expect.objectContaining({ message: 'could not find java CLI, please make sure java is installed' }))
})

test('should fail if docker CLI is not installed', async () => {
  utils.hasJavaCLI.mockResolvedValueOnce(true)
  utils.hasDockerCLI.mockResolvedValueOnce(false)

  await expect(runDevLocal(LOCAL_CONFIG)).rejects.toEqual(expect.objectContaining({ message: 'could not find docker CLI, please make sure docker is installed' }))
})

test('should fail if docker is not running', async () => {
  utils.hasJavaCLI.mockResolvedValueOnce(true)
  utils.hasDockerCLI.mockResolvedValueOnce(true)
  utils.isDockerRunning.mockResolvedValueOnce(false)

  await expect(runDevLocal(LOCAL_CONFIG)).rejects.toEqual(expect.objectContaining({ message: 'docker is not running, please make sure to start docker' }))
})

test('should download openwhisk-standalone.jar if it does not exist', async () => {
  utils.hasJavaCLI.mockResolvedValueOnce(true)
  utils.hasDockerCLI.mockResolvedValueOnce(true)
  utils.isDockerRunning.mockResolvedValueOnce(true)

  await runDevLocal(LOCAL_CONFIG)

  expect(utils.downloadOWJar).toHaveBeenCalledWith(OW_JAR_URL, OW_JAR_PATH)
})

test('should *not* download openwhisk-standalone.jar if it exists', async () => {
  utils.hasJavaCLI.mockResolvedValueOnce(true)
  utils.hasDockerCLI.mockResolvedValueOnce(true)
  utils.isDockerRunning.mockResolvedValueOnce(true)

  fs.existsSync.mockImplementation(f => {
    return true
  })

  await runDevLocal(LOCAL_CONFIG)
  expect(utils.downloadOWJar).not.toHaveBeenCalled()
})

test('run openwhisk jar', async () => {
  utils.hasJavaCLI.mockResolvedValueOnce(true)
  utils.hasDockerCLI.mockResolvedValueOnce(true)
  utils.isDockerRunning.mockResolvedValueOnce(true)

  await runDevLocal(LOCAL_CONFIG)
  // test first argument of first call
  expect(utils.runOpenWhiskJar.mock.calls[0][0]).toEqual(OW_JAR_PATH)
})

test('coverage (default parameters)', async () => {
  utils.hasJavaCLI.mockResolvedValueOnce(true)
  utils.hasDockerCLI.mockResolvedValueOnce(true)
  utils.isDockerRunning.mockResolvedValueOnce(true)

  await runDevLocal(LOCAL_CONFIG, () => {}, true)
  expect(utils.runOpenWhiskJar).toHaveBeenCalled()
})

test('return value and cleanup', async () => {
  utils.hasJavaCLI.mockResolvedValueOnce(true)
  utils.hasDockerCLI.mockResolvedValueOnce(true)
  utils.isDockerRunning.mockResolvedValueOnce(true)

  utils.runOpenWhiskJar.mockResolvedValueOnce({
    proc: {
      kill: jest.fn()
    }
  })

  fs.existsSync
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)

  const { cleanup, config } = await runDevLocal(LOCAL_CONFIG, () => {}, true)
  expect(typeof cleanup).toEqual('function')
  expect(typeof config).toEqual('object')
  expect(cleanup).not.toThrow()
})
