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
    response.data.jobs.forEach(j => {
      if (j.conclusion) {
        core.info(`${j.name}: ${j.conclusion}`);
        outcomes.push(j.conclusion.toLowerCase());
      } else {
        core.info(`${j.name} has not concluded yet.`);
      }
    });
    return outcomes;
  } catch (error) {
    core.info(`An error occurred getting the jobs for the workflow run: ${error}`);
  }
}

async function run() {
  const outcomes = await getJobOutcomes();

  const fallback = core.getInput('fallback-conclusion');
  let conclusion = fallback;

  // Skipped seems to be the outcome when it is cancelled, so check for that first.
  // Then if there are any failures set it as a failure, otherwise it will most
  // likely be success.
  if (outcomes.includes('skipped')) {
    conclusion = 'skipped';
  } else if (outcomes.includes('cancelled')) {
    conclusion = 'cancelled';
  } else if (outcomes.includes('failure')) {
    conclusion = 'failure';
  } else if (outcomes.includes('success')) {
    conclusion = 'success';
  }
  core.info(`The workflow outcome to this point is: ${conclusion}`);
  core.setOutput('conclusion', conclusion);
  core.exportVariable('WORKFLOW_CONCLUSION', conclusion);
}

run();
