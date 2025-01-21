/*
Copyright 2024 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const fs = require('fs')
const auditLogger = require('../../../src/lib/audit-logger')

jest.mock('fs')
jest.mock('chalk', () => ({
  red: jest.fn((text) => text),
  bold: jest.fn((text) => text)
}))

const OPERATIONS = {
  AB_APP_DEPLOY: 'ab_app_deploy',
  AB_APP_UNDEPLOY: 'ab_app_undeploy',
  AB_APP_ASSETS_UNDEPLOYED: 'ab_app_assets_undeployed',
  AB_APP_ASSETS_DEPLOYED: 'ab_app_assets_deployed',
  AB_APP_TEST: 'ab_app_test'
}

const mockToken = 'mocktoken'
const mockEnv = 'stage'
const mockLogEvent = {
  projectId: 'mockproject',
  orgId: 'mockorg'
}

beforeEach(() => {
  setFetchMock(true, 200, {})
})

test('sendAuditLogs with valid params', async () => {
  setFetchMock(true, 200, {})
  const options = {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + mockToken,
      'Content-type': 'application/json'
    },
    body: JSON.stringify({ event: mockLogEvent })
  }
  await auditLogger.sendAuditLogs(mockToken, mockLogEvent, mockEnv)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(auditLogger.AUDIT_SERVICE_ENDPOINTS[mockEnv], options)
})

// NOTE: this test is blocked until the audit service is available in prod
test('sendAuditLogs with default params', async () => {
  setFetchMock(true, 200, {})
  const options = {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + mockToken,
      'Content-type': 'application/json'
    },
    body: JSON.stringify({ event: mockLogEvent })
  }
  await auditLogger.sendAuditLogs(mockToken, mockLogEvent)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(auditLogger.AUDIT_SERVICE_ENDPOINTS.prod, options)
})

test('should take prod endpoint if calling sendAuditLogs with non-exisiting env', async () => {
  setFetchMock(true, 200, {})
  const options = {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + mockToken,
      'Content-type': 'application/json'
    },
    body: JSON.stringify({ event: mockLogEvent })
  }
  await auditLogger.sendAuditLogs(mockToken, mockLogEvent, 'dev')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(auditLogger.AUDIT_SERVICE_ENDPOINTS.prod, options)
})

test('sendAuditLogs error response', async () => {
  setFetchMock(false, 400, {})
  const options = {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + mockToken,
      'Content-type': 'application/json'
    },
    body: JSON.stringify({ event: mockLogEvent })
  }
  await expect(auditLogger.sendAuditLogs(mockToken, mockLogEvent, mockEnv)).rejects.toThrow('Failed to send audit log - 400')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(auditLogger.AUDIT_SERVICE_ENDPOINTS[mockEnv], options)
})

describe('getAuditLogEvent', () => {
  const flags = { flag1: 'value1' }
  const project = {
    org: { id: 'org123' },
    id: 'proj456',
    workspace: { id: 'ws789', name: 'testWorkspace' }
  }

  const mockDeployMessage = 'Starting deployment for the App Builder application in workspace testWorkspace'
  const mockUndeployMessage = 'Starting undeployment for the App Builder application in workspace testWorkspace'

  test('should return correct log event for AB_APP_DEPLOY event', () => {
    const event = 'AB_APP_DEPLOY'
    const result = auditLogger.getAuditLogEvent(flags, project, event)

    expect(result).toEqual({
      orgId: 'org123',
      projectId: 'proj456',
      workspaceId: 'ws789',
      workspaceName: 'testWorkspace',
      operation: OPERATIONS.AB_APP_DEPLOY,
      timestamp: expect.any(Number),
      data: {
        cliCommandFlags: flags,
        opDetailsStr: mockDeployMessage
      }
    })
  })

  test('should return correct log event for AB_APP_UNDEPLOY event', () => {
    const event = 'AB_APP_UNDEPLOY'
    const result = auditLogger.getAuditLogEvent(flags, project, event)

    expect(result).toEqual({
      orgId: 'org123',
      projectId: 'proj456',
      workspaceId: 'ws789',
      workspaceName: 'testWorkspace',
      operation: OPERATIONS.AB_APP_UNDEPLOY,
      timestamp: expect.any(Number),
      data: {
        cliCommandFlags: flags,
        opDetailsStr: mockUndeployMessage
      }
    })
  })

  test('should return correct log event for AB_APP_ASSETS_UNDEPLOYED event', () => {
    const event = 'AB_APP_ASSETS_UNDEPLOYED'
    const result = auditLogger.getAuditLogEvent(flags, project, event)

    expect(result).toEqual({
      orgId: 'org123',
      projectId: 'proj456',
      workspaceId: 'ws789',
      workspaceName: 'testWorkspace',
      operation: OPERATIONS.AB_APP_ASSETS_UNDEPLOYED,
      timestamp: expect.any(Number),
      data: {
        cliCommandFlags: flags,
        opDetailsStr: 'All static assets for the App Builder application in workspace: testWorkspace were successfully undeployed from the CDN'
      }
    })
  })

  test('should return correct log event for AB_APP_ASSETS_DEPLOYED event', () => {
    const event = 'AB_APP_ASSETS_DEPLOYED'
    const result = auditLogger.getAuditLogEvent(flags, project, event)

    expect(result).toEqual({
      orgId: 'org123',
      projectId: 'proj456',
      workspaceId: 'ws789',
      workspaceName: 'testWorkspace',
      operation: OPERATIONS.AB_APP_ASSETS_DEPLOYED,
      timestamp: expect.any(Number),
      data: {
        cliCommandFlags: flags,
        opDetailsStr: 'All static assets for the App Builder application in workspace: testWorkspace were successfully deployed to the CDN.\n Files deployed - '
      }
    })
  })

  test('should return undefined if project or workspace is missing', () => {
    const event = 'AB_APP_DEPLOY'
    const result = auditLogger.getAuditLogEvent(flags, {}, event)

    expect(result).toBeFalsy()
  })

  test('should default operation to APP_TEST if event is not found in OPERATIONS', () => {
    const event = 'UNKNOWN_EVENT'
    const result = auditLogger.getAuditLogEvent(flags, project, event)

    expect(result).toEqual({
      orgId: 'org123',
      projectId: 'proj456',
      workspaceId: 'ws789',
      workspaceName: 'testWorkspace',
      operation: OPERATIONS.AB_APP_TEST,
      timestamp: expect.any(Number),
      data: {
        cliCommandFlags: flags,
        opDetailsStr: undefined
      }
    })
  })
})

describe('getFilesCountWithExtension', () => {
  const directory = '__fixtures__/app/web-src'

  // Mock 'this.log'
  const mockLog = jest.fn()

  beforeEach(() => {
    mockLog.mockClear() // Clear mock between tests
  })

  it('should return an error message when directory does not exist', () => {
    fs.existsSync.mockReturnValue(false)

    const result = auditLogger.getFilesCountWithExtension.call({ log: mockLog }, directory)

    expect(fs.existsSync).toHaveBeenCalledWith(directory)
    expect(mockLog).toHaveBeenCalledWith(
      'Error: Directory __fixtures__/app/web-src does not exist.'
    )
    expect(result).toEqual([])
  })

  it('should return an error message when directory is empty', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readdirSync.mockReturnValue([])

    const result = auditLogger.getFilesCountWithExtension.call({ log: mockLog }, directory)

    expect(fs.readdirSync).toHaveBeenCalledWith(directory, { recursive: true })
    expect(mockLog).toHaveBeenCalledWith(
      'Error: No files found in directory __fixtures__/app/web-src.'
    )
    expect(result).toEqual([])
  })

  it('should return a count of different file types', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readdirSync.mockReturnValue(['index.html', 'script.js', 'styles.css', 'image.png', 'image.jpg', 'readme'])

    const result = auditLogger.getFilesCountWithExtension.call({ log: mockLog }, directory)
    // this really should be 2 image(s) but there is a side effect in the code that makes it split by ext
    // and this makes more sense than seeing 1 image(s), 1 image(s)
    expect(result).toEqual([
      '1 HTML page(s)\n',
      '1 Javascript file(s)\n',
      '1 CSS file(s)\n',
      '1 .png image(s)\n',
      '1 .jpg image(s)\n',
      '1 file(s) without extension\n'
    ])
  })

  it('should handle directories with files of the same type', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readdirSync.mockReturnValue(['script1.js', 'script2.js', 'script3.js'])

    const result = auditLogger.getFilesCountWithExtension.call({ log: mockLog }, directory)

    expect(result).toEqual(['3 Javascript file(s)\n'])
  })

  it('should handle files with no extension', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readdirSync.mockReturnValue(['readme', 'LICENSE'])

    const result = auditLogger.getFilesCountWithExtension.call({ log: mockLog }, directory)

    expect(result).toEqual(['2 file(s) without extension\n'])
  })

  it('should handle files with other extensions', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readdirSync.mockReturnValue(['data.json', 'document.pdf'])

    const result = auditLogger.getFilesCountWithExtension.call({ log: mockLog }, directory)

    expect(result).toEqual([
      '1 .json file(s)\n',
      '1 .pdf file(s)\n'
    ])
  })
})
