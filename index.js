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

class TestLinkReporter extends mocha.reporters.Spec {
  constructor (runner, options) {
    super(runner, options)

    this.testlink = this.establishTestLinkConnection(options)

    this.buildid = 1

    this.promiseChain = this.testlink.checkDevKey().catch(console.error)

    runner
      .once(EVENT_RUN_BEGIN, () => {
        this.testplanid = this.createTestPlan()
      })
      .on(EVENT_SUITE_END, suite =>
        this.publishTestResults(suite, caseId => this.suiteOptions(caseId, suite))
      )
      .on(EVENT_TEST_PASS, test =>
        this.publishTestResults(test, caseId => this.tcOptions(caseId, test.duration))
      )
      .on(EVENT_TEST_FAIL, (test, err) =>
        this.publishTestResults(test, caseId => this.tcOptions(caseId, test.duration, err))
      )
  }

  /**
   * Extracts test status and publishes the result to TestLink.
   * @param {Test|Suite} testObj with execution results
   * @param {Function} optionsGen returns options based on caseId
   */
  publishTestResults (testObj, optionsGen) {
    for (const caseId of this.titleToCaseIds(testObj.title)) {
      const options = optionsGen(caseId)
      this.promiseChain = this.promiseChain.then(() => this.testlink.reportTCResult(options)).catch(console.error)
    }
  }

  /**
   * Builds a connection object based on the parameters specified in the command line.
   * @param {object} options passed to the reporter from the command line
   * @returns {TestLink} object
   */
  establishTestLinkConnection (options) {
    return new TestLink({
      host: 'localhost',
      port: 80,
      secure: false,
      apiKey: '6bfa04dbfbc5463925786ef48d1793d4' // The API KEY from TestLink. Get it from user profile.
    })
  }

  /**
   * Creates a new test plan in TestLink
   * @returns the id of the created plan
   */
  createTestPlan () {
    // TODO implement the function
    return 14
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
   * Generates the options for a TestLink case+steps that are mapped to mocha test suite+tests
   * @param {string} testcaseexternalid e.g. XPJ-112
   * @param {Suite} suite that is mapped to a TestLink test case
   * @returns {object} with test suite options
   */
  suiteOptions (testcaseexternalid, suite) {
    // the suite is failed if any of its tests failed
    const status = suite.tests.some(t => t.state === 'failed') ? ExecutionStatus.FAILED : ExecutionStatus.PASSED
    // the sum total duration of the constituent tests
    const execduration = suite.tests.reduce((acc, t) => acc + t.duration, 0) / 60000

    return {
      testcaseexternalid,
      testplanid: this.testplanid,
      status,
      buildid: this.buildid,
      execduration,
      steps: []
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
