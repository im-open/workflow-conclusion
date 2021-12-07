const core = require('@actions/core');
const github = require('@actions/github');

const ghToken = core.getInput('github-token');
const octokit = github.getOctokit(ghToken);
const owner = github.context.repo.owner;
const repo = github.context.repo.repo;

async function getJobOutcomes() {
  try {
    const response = await octokit.rest.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: github.context.runId
    });
    if (!response || !response.data || !response.data.jobs || response.data.jobs.length === 0) {
      core.info(`There were no jobs associated with the workflow run.`);
      return [];
    }
    let outcomes = [];
    core.info('\nIndividual Job Statuses:');
    response.data.jobs.forEach(j => {
      if (j.conclusion) {
        core.info(`\t${j.name}: ${j.conclusion}`);
        outcomes.push(j.conclusion.toLowerCase());
      } else {
        core.info(`\t${j.name}: Has not concluded yet.`);
      }
    });
    return outcomes;
  } catch (error) {
    core.info(`An error occurred getting the jobs for the workflow run: ${error}`);
  }
}

function processAdditionalOutcomes(outcomes) {
  let additionalConclusionsRaw = core.getInput('additional-conclusions');
  if (!additionalConclusionsRaw || additionalConclusionsRaw.trim().length === 0) return;

  let additionalConclusions = JSON.parse(additionalConclusionsRaw);
  const willNotContribute = 'This conclusion will not contribute to the final workflow conclusion.';
  core.info('\nAdditional Conclusions:');

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
        core.warning(`${ac.name}: ${ac.conclusion} => cancelled`);
        break;
      case 'skipped':
      case 'skip':
        outcomes.push('skipped');
        core.warning(`${ac.name}: ${ac.conclusion} => skipped`);
        break;
      case '':
        core.warning(
          `${ac.name} appears to be empty because the step may not have been run.  ${willNotContribute}`
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
  processAdditionalOutcomes(outcomes);

  const fallback = core.getInput('fallback-conclusion');
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
