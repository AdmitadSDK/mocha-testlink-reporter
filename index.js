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

    const testlink = new TestLink({
      host: 'localhost',
      port: 80,
      secure: false,
      apiKey: '6bfa04dbfbc5463925786ef48d1793d4' // The API KEY from TestLink. Get it from user profile.
    })

    this.buildid = 1

    let promiseChain = testlink.checkDevKey().catch(console.error)

    runner
      .once(EVENT_RUN_BEGIN, () => {
        // TODO: create a new test plan in TestLink
        this.testplanid = 14
      })
      .on(EVENT_SUITE_END, suite => {
        for (const caseId of this.titleToCaseIds(suite.title)) {
          const options = this.suiteOptions(caseId, suite)
          promiseChain = promiseChain.then(() => testlink.reportTCResult(options)).catch(console.error)
        }
      })
      .on(EVENT_TEST_PASS, test => {
        for (const caseId of this.titleToCaseIds(test.title)) {
          const options = this.tcOptions(caseId, test.duration)
          promiseChain = promiseChain.then(() => testlink.reportTCResult(options)).catch(console.error)
        }
      })
      .on(EVENT_TEST_FAIL, (test, err) => {
        for (const caseId of this.titleToCaseIds(test.title)) {
          const options = this.tcOptions(caseId, test.duration, err)
          promiseChain = promiseChain.then(() => testlink.reportTCResult(options)).catch(console.error)
        }
      })
  }

  /**
   * Extracts TestLink ids of the form [XPJ-112]. A single case (title) may have several ids specified.
   * @param {string} title of the test case
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
