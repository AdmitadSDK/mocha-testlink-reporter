'use strict'

const TestLink = require('testlink-xmlrpc')
const { ExecutionStatus } = require('testlink-xmlrpc/lib/constants')

const mocha = require('mocha')
const {
  EVENT_RUN_BEGIN,
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_SUITE_END
} = mocha.Runner.constants
const {
  STATE_PASSED
} = mocha.Runnable.constants

class TestLinkReporter extends mocha.reporters.Spec {
  constructor (runner, options) {
    super(runner, options)

    const reporterOptions = options.reporterOptions
    this.validateReporterOptions(reporterOptions)

    this.testlink = this.establishTestLinkConnection(reporterOptions)

    // The chain is used to report test statuses in the order they become available during execution
    // An alternative would be to collect the statuses and publish them in one go at the end, but
    // they would be lost if the execution is aborted or the system crashes
    this.promiseChain = this.testlink.checkDevKey().catch(console.error)

    runner
      .once(EVENT_RUN_BEGIN, () => {
        this.lookupTestProject(reporterOptions)
        this.createTestPlan(reporterOptions)
        this.createBuild(reporterOptions)
        this.promiseChain = this.promiseChain.catch(console.error)
      })
      .on(EVENT_SUITE_END, suite =>
        this.publishTestResults(suite.title, caseId => this.suiteOptions(caseId, suite))
      )
      .on(EVENT_TEST_PASS, test =>
        this.publishTestResults(test.title, caseId => this.tcOptions(caseId, test.duration))
      )
      .on(EVENT_TEST_FAIL, (test, err) =>
        this.publishTestResults(test.title, caseId => this.tcOptions(caseId, test.duration, err))
      )
  }

  /**
   * Updates the TestLink status of each case id mentioned in the supplied title.
   * Adds the tests to the test plan for newly created plans.
   * @param {string} title of the test to extract case ids from
   * @param {Function} optionsGen returns options based on caseId
   */
  publishTestResults (title, optionsGen) {
    for (const caseId of this.titleToCaseIds(title)) {
      this.promiseChain = this.promiseChain
        .then(async () => {
          const options = optionsGen(caseId)

          await this.testlink.addTestCaseToTestPlan({
            testprojectid: this.testProject.id,
            testplanid: this.testplanid,
            testcaseexternalid: options.testcaseexternalid,
            version: 1
          })
          return this.testlink.reportTCResult(options)
        })
        .catch(console.error)
    }
  }

  /**
   * Builds a connection object based on the parameters specified in the command line.
   * @param {object} options passed in --reporter-options command-line parameter
   * @returns {TestLink} object
   */
  establishTestLinkConnection (options) {
    const url = new URL(options.URL)
    return new TestLink({
      host: url.hostname,
      port: url.port,
      secure: url.protocol === 'https:',
      apiKey: options.apiKey
    })
  }

  validateReporterOptions (options) {
    if (!options) {
      throw new Error('Missing --reporter-options')
    }
    for (const opt of ['URL', 'apiKey', 'prefix']) {
      if (!options[opt]) {
        throw new Error(`Missing ${opt} option in --reporter-options`)
      }
    }
    if ((options['buildid'] || options['buildname']) && !(options['testplanid'] || options['testplanname'])) {
      throw new Error('Please specify testplanid or testplanname in --reporter-options')
    }
  }

  /**
   * Creates a test plan if it doesn't exist.
   * @param {object} options reporter options
   */
  createTestPlan (options) {
    if (options['testplanid']) {
      this.testplanid = options['testplanid']
    } else {
      this.promiseChain = this.promiseChain.then(async () => {
        const testplanname = options['testplanname'] ? options['testplanname'] : `autoplan ${new Date().toISOString()}`

        const testPlans = await this.testlink.getProjectTestPlans({
          testprojectid: this.testProject.id
        })
        let testPlan = Array.isArray(testPlans) && testPlans.find(p => p.name === testplanname)

        if (!testPlan) {
          const res = await this.testlink.createTestPlan({
            testplanname,
            prefix: options.prefix
          })
          testPlan = res[0]
          console.log(`A new test plan '${testplanname}' with id ${testPlan.id} was created in TestLink`)
        }
        this.testplanid = testPlan.id
      })
    }
  }

  /**
   * Creates a build if it doesn't exist. Assumes that a test plan already exists
   * @param {object} options reporter options
   */
  createBuild (options) {
    if (options['buildid']) {
      this.buildid = options.buildid
    } else {
      this.promiseChain = this.promiseChain.then(async () => {
        const buildname = options['buildname'] ? options['buildname'] : 'autobuild'

        const builds = await this.testlink.getBuildsForTestPlan({
          testplanid: this.testplanid
        })
        let build = Array.isArray(builds) && builds.find(b => b.name === buildname)

        if (!build) {
          const res = await this.testlink.createBuild({
            testplanid: this.testplanid,
            buildname,
            buildnotes: '',
            active: true,
            open: true,
            releasedate: ''
          })
          build = res[0]
          console.log(`A new build '${buildname}' with id ${build.id} was created in TestLink`)
        }
        this.buildid = build.id
      })
    }
  }

  /**
   * Look up the test project from its prefix
   * @param {object} options reporter options
   */
  lookupTestProject (options) {
    this.promiseChain = this.promiseChain.then(async () => {
      const projects = await this.testlink.getProjects()
      this.testProject = projects.find(p => p.prefix === options['prefix'])

      if (!this.testProject) {
        throw Error(`No project with prefix ${options['prefix']} was found`)
      }
    })
  }

  /**
   * Extracts TestLink ids of the form [XPJ-112]. A single case (title) may have several ids specified.
   * @param {string} title of the test case
   * @returns {Array} of case ids
   */
  titleToCaseIds (title) {
    const caseIds = []
    const re = /\[(\w+-\d+)\]/g

    for (const match of title.matchAll(re)) {
      caseIds.push(match[1])
    }
    return caseIds
  }

  /**
   * Generates the options for a TestLink case with steps that are mapped to a mocha suite with tests
   * @param {string} testcaseexternalid e.g. XPJ-112
   * @param {Suite} suite that is mapped to a TestLink test case
   * @returns {object} with test suite options
   */
  suiteOptions (testcaseexternalid, suite) {
    // the suite is failed if any of its tests failed
    const status = suite.tests.some(t => t.isFailed()) ? ExecutionStatus.FAILED : ExecutionStatus.PASSED
    // the sum total duration of the constituent tests
    const execduration = suite.tests.reduce((acc, t) => acc + t.duration, 0) / 60000

    // collect the statuses of the constituent tests
    const steps = suite.tests.map((t, idx) => {
      return {
        step_number: idx + 1,
        result: t.isPending() ? ExecutionStatus.NOT_RUN : (t.isPassed() ? ExecutionStatus.PASSED : ExecutionStatus.FAILED),
        notes: t.err ? t.err.stack : '' }
    })

    return {
      testcaseexternalid,
      testplanid: this.testplanid,
      status,
      buildid: this.buildid,
      execduration,
      steps
    }
  }

  /**
   * Call this function only within EVENT_TEST_PASS and EVENT_TEST_FAIL handlers
   * @param {string} testcaseexternalid e.g. XPJ-112
   * @param {int} duration test.duration
   * @param {Error} err object
   * @returns {object} with test case options
   */
  tcOptions (testcaseexternalid, duration, err) {
    const status = err ? ExecutionStatus.FAILED : ExecutionStatus.PASSED
    const notes = err ? err.stack : ''

    return {
      testcaseexternalid,
      testplanid: this.testplanid,
      status,
      buildid: this.buildid,
      execduration: duration / 60000,
      notes,
      steps: []
    }
  }
}

module.exports = TestLinkReporter
