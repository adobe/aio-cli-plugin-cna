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

const DOCKER_ORG = 'adobeapiplatform'
const DOCKER_REPOS = { // repo-name:kind
  'adobe-action-nodejs-v10': 'nodejs:10',
  'adobe-action-nodejs-v12': 'nodejs:12',
  'adobe-action-nodejs-v14': 'nodejs:14',
  'adobe-action-nodejs-v16': 'nodejs:16',
  'adobe-action-nodejs-v18': 'nodejs:18',
  'adobe-action-nodejs-v20': 'nodejs:20'
}

const DEFAULT_KIND = 'nodejs:18'

/** @private */
async function main () {
  const nodejs = []

  for (const [repoName, kind] of Object.entries(DOCKER_REPOS)) {
    const data = await fetch(`https://registry.hub.docker.com/v2/repositories/${DOCKER_ORG}/${repoName}/tags`)
    const json = await data.json()
    const defaultKind = (kind === DEFAULT_KIND) ? true : undefined

    nodejs.push({
      kind,
      default: defaultKind,
      image: {
        prefix: DOCKER_ORG,
        name: repoName,
        tag: json.results[0].name
      }
    })
  }

  const output = {
    runtimes: {
      nodejs
    }
  }
  console.log(JSON.stringify(output, null, 2))
}

main()
  .catch(console.error)
