const core = require('@actions/core');
const github = require('@actions/github');

// When used, this requiredArgOptions will cause the action to error if a value has not been provided.
const requiredArgOptions = {
  required: true,
  trimWhitespace: true
};

const ghToken = core.getInput('github-token', requiredArgOptions);
const octokit = github.getOctokit(ghToken);
const owner = github.context.repo.owner;
const repo = github.context.repo.repo;

async function getJobOutcomes() {
  let outcomes = [];
  await octokit
    .paginate(octokit.rest.actions.listJobsForWorkflowRun, {
      owner,
      repo,
      run_id: github.context.runId
    })
    .then(jobs => {
      if (jobs.length > 0) {
        core.info('\nIndividual Job Statuses:');
        for (const j of jobs) {
          if (j.conclusion) {
            core.info(`\t${j.name}: ${j.conclusion}`);
            outcomes.push(j.conclusion.toLowerCase());
          } else {
            core.info(`\t${j.name}: Has not concluded yet.`);
          }
        }
      } else {
        core.info(`There were no jobs associated with the workflow run.`);
      }
    })
    .catch(error => {
      core.error(`An error occurred getting the jobs for the workflow run: ${error.message}`);
    });
  return outcomes;
}

function processAdditionalOutcomes(outcomes, fallbackConclusion) {
  const additionalConclusionsRaw = core.getInput('additional-conclusions');
  const suppressFallBackWarnings = core.getBooleanInput('suppress-fallback-warnings');

  if (!additionalConclusionsRaw || additionalConclusionsRaw.trim().length === 0) return;

  const willNotContributeMsg = `This conclusion will not contribute to the final workflow conclusion.`;

  const additionalConclusions = JSON.parse(additionalConclusionsRaw);
  core.info('\nAdditional Conclusions:');

  // This will be called for cancelled/skipped/empty conclusions.  Depending on the
  // workflow's preference, these conclusions may be logged as infos or warnings.
  const printConclusion = (message, conclusion) => {
    const conclusionIsEmptyOrDefault = !conclusion || conclusion === fallbackConclusion;
    suppressFallBackWarnings && conclusionIsEmptyOrDefault
      ? core.info(message)
      : core.warning(message);
  };

  additionalConclusions.forEach(ac => {
    const formattedConclusion = ac.conclusion.toLowerCase().trim();
    switch (formattedConclusion) {
      case 'failing':
      case 'failed':
      case 'failure':
      case 'fail':
        outcomes.push('failure');
        core.warning(`\t${ac.name}: ${ac.conclusion} => failure`);
        break;
      case 'passing':
      case 'passed':
      case 'pass':
      case 'success':
        outcomes.push('success');
        core.info(`\t${ac.name}: ${ac.conclusion} => success`);
        break;
      case 'cancelled':
      case 'canceled':
      case 'cancel':
        outcomes.push('cancelled');
        const cancelledMessage = `${ac.name}: ${ac.conclusion} => cancelled`;
        printConclusion(cancelledMessage, formattedConclusion);
        break;
      case 'skipped':
      case 'skip':
        outcomes.push('skipped');
        const skippedMessage = `${ac.name}: ${ac.conclusion} => skipped`;
        printConclusion(skippedMessage, formattedConclusion);
        break;
      case '':
        const emptyMessage = `${ac.name} appears to be empty because the step may not have been run. ${willNotContributeMsg}`;
        printConclusion(emptyMessage, formattedConclusion);
        break;
      default:
        const unknownMessage = `${ac.name} has an unknown option (${formattedConclusion}).  ${willNotContributeMsg}`;
        core.warning(unknownMessage);
        break;
    }
  });
}

async function run() {
  const fallbackConclusion = core.getInput('fallback-conclusion').toLowerCase(); // The default is 'skipped'

  const outcomes = await getJobOutcomes();
  processAdditionalOutcomes(outcomes, fallbackConclusion);

  let conclusion = fallbackConclusion;

  if (outcomes.includes('cancelled')) {
    conclusion = 'cancelled';
  } else if (outcomes.includes('failure')) {
    conclusion = 'failure';
  } else if (outcomes.includes('success')) {
    conclusion = 'success';
  }
  core.info(`\nThe workflow outcome to this point is: ${conclusion}`);
  core.setOutput('workflow_conclusion', conclusion);
  core.exportVariable('WORKFLOW_CONCLUSION', conclusion);

  core.info(`The outputs have been set`);
  core.info(`\tsteps.<step-id>.workflow_conclusion = ${conclusion}`);
  core.info(`\tenv.WORKFLOW_CONCLUSION = ${conclusion}`);
}

run();
