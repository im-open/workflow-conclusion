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

function processAdditionalOutcomes(outcomes, fallback) {
  let additionalConclusionsRaw = core.getInput('additional-conclusions');
  const suppressFallBackWarnings = core.getBooleanInput('suppress-fallback-warnings');

  if (!additionalConclusionsRaw || additionalConclusionsRaw.trim().length === 0) return;

  let additionalConclusions = JSON.parse(additionalConclusionsRaw);
  const willNotContribute = 'This conclusion will not contribute to the final workflow conclusion.';
  core.info('\nAdditional Conclusions:');

  const handleFallbackWarnings = (message, conclusion) => {
    (!conclusion || conclusion === fallback.toLowerCase()) && suppressFallBackWarnings
      ? core.info(message)
      : core.warning(message);
  };

  additionalConclusions.forEach(ac => {
    const cleanConclusion = ac.conclusion.toLowerCase().trim();
    switch (cleanConclusion) {
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
        handleFallbackWarnings(`${ac.name}: ${ac.conclusion} => cancelled`, cleanConclusion);
        break;
      case 'skipped':
      case 'skip':
        outcomes.push('skipped');
        handleFallbackWarnings(`${ac.name}: ${ac.conclusion} => skipped`, cleanConclusion);
        break;
      case '':
        handleFallbackWarnings(
          `${ac.name} appears to be empty because the step may not have been run. ${willNotContribute}`,
          cleanConclusion
        );
        break;
      default:
        core.warning(
          `${ac.name} has an unknown option (${cleanConclusion}).  ${willNotContribute}`
        );
        break;
    }
  });
}

async function run() {
  let outcomes = await getJobOutcomes();
  const fallback = core.getInput('fallback-conclusion');
  processAdditionalOutcomes(outcomes, fallback);

  let conclusion = fallback;

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
  core.info(`\tsteps.step-id.workflow_conclusion = ${conclusion}`);
  core.info(`\tenv.WORKFLOW_CONCLUSION = ${conclusion}`);
}

run();
