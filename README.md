# workflow-conclusion

This action will:

1. Use the [Actions REST API] to get the conclusion for each previous job.
   - The API call provides the `conclusion` which is the job status after `continue-on-error` is applied.
   - In addition to jobs, the API call also includes status check results.
2. Examine each additional conclusion that is provided through the `additional-conclusions` argument.  
3. Determine a single workflow conclusion based on the API results and arguments.  

The action will interpret a wider range of inputs in the `additional-conclusions` argument than the standard GitHub values of *cancelled, skipped, failure and success*.  This allows using the `outcome` of a step as well as the output that an action might set.

- `[cancelled | canceled | cancel]` are accepted and interpreted as `cancelled`
- `[failure | failing | failed | fail]` are accepted and interpreted as `failure`
- `[success | passing | passed | pass]` are accepted and interpreted as `success`
- `[skipped | skip]` are accepted and interpreted as `skipped`

The final workflow conclusion is determined by:

- First looking for any Cancelled conclusions and if found the conclusion is set to `cancelled`
- Then looking for any Failed conclusions and if found the conclusion is set to `failure`
- Finally looking for any Successful conclusions and if found the conclusion is set to `success`
- If none of the statuses are found, it will set the workflow conclusion to the fallback value which defaults to `skipped`

## Index

- [Inputs](#inputs)
- [Outputs](#outputs)
- [Usage](#usage)
- [Contributing](#contributing)
  - [Recompiling](#recompiling)
  - [Incrementing the Version](#incrementing-the-version)
- [Code of Conduct](#code-of-conduct)
- [License](#license)

## Inputs
| Parameter                | Is Required | Description                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token`           | true        | The token used to make API requests                                                                                                                                                                                                                                                                             |
| `additional-conclusions` | false       | A JSON-parseable array of additional conclusions to consider.  See the comments above for accepted values.  See the [Usage Example](#usage) below for the correct format.  <br/><br/>This may be helpful if `continue-on-error` is used on a steps or for actions that provide an output with their own status. |
| `fallback-conclusion`    | false       | The fallback conclusion to use when one cannot be determined.  Defaults to skipped.                                                                                                                                                                                                                             |

## Outputs
| Output                | Description              |
| --------------------- | ------------------------ |
| `workflow-conclusion` | The workflow conclusion. |

## Usage

```yml
jobs:
  ...
  
  test:
    runs-on: [ubuntu-20.04]
    outputs: 
      test-step-outcome: ${{ steps.test.outcome }}             # Can be: cancelled, skipped, failure, success
      test-check-result: ${{ steps.test_check.test-outcome }}  # Can be:  Failed, Passed
    steps:
      - name: dotnet test with coverage
        id: test
        continue-on-error: true
        run: dotnet test --logger trx --configuration Release /property:CollectCoverage=True /property:CoverletOutputFormat=opencover
      
      - name: Process dotnet test results and create a status check
        id: test_check
        uses: im-open/process-dotnet-test-results@v2.2.3
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          
  ...

  update-deployment-board:
    runs-on: [ubuntu-20.04]
    needs: [test, auto-deploy-to-dev]
    if: always()
    steps:
      - uses: im-open/workflow-conclusion@v2.1.1
        id: conclusion
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          # needs.test.outputs.test-step-outcome is step status before continue-on-error is applied.  Could be cancelled, skipped, failure, success.
          # needs.test.outputs.test-check-result is an output of the process-dotnet-test-results action.  Could be Failed or Passed
          additional-conclusions: |
            [
              { "name": "dotnet-test-coverage", "conclusion" : "${{ needs.test.outputs.test-step-outcome }}" }, 
              { "name": "process-test-results", "conclusion" : "${{ needs.test.outputs.test-check-result }}" }
            ]
      
      # Use the workflow conclusion below
      - name: Update Deployment Board
        uses: im-open/update-deployment-board@v1.5.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN}}
          environment: ${{ github.event.inputs.environment }}
          board-number: 1
          ref: ${{ github.event.inputs.branch-tag-sha }}
          deploy-status: ${{ env.WORKFLOW_CONCLUSION }} # can also use ${{ steps.conclusion.workflow-conclusion }}
```

## Contributing

When creating new PRs please ensure:

1. The action has been recompiled.  See the [Recompiling](#recompiling) section below for more details.
2. For major or minor changes, at least one of the commit messages contains the appropriate `+semver:` keywords listed under [Incrementing the Version](#incrementing-the-version).
3. The `README.md` example has been updated with the new version.  See [Incrementing the Version](#incrementing-the-version).
4. The action code does not contain sensitive information.

### Recompiling

If changes are made to the action's code in this repository, or its dependencies, you will need to re-compile the action.

```sh
# Installs dependencies and bundles the code
npm run build

# Bundle the code (if dependencies are already installed)
npm run bundle
```

These commands utilize [esbuild](https://esbuild.github.io/getting-started/#bundling-for-node) to bundle the action and
its dependencies into a single file located in the `dist` folder.

### Incrementing the Version

This action uses [git-version-lite] to examine commit messages to determine whether to perform a major, minor or patch increment on merge.  The following table provides the fragment that should be included in a commit message to active different increment strategies.
| Increment Type | Commit Message Fragment                     |
| -------------- | ------------------------------------------- |
| major          | +semver:breaking                            |
| major          | +semver:major                               |
| minor          | +semver:feature                             |
| minor          | +semver:minor                               |
| patch          | *default increment type, no comment needed* |

## Code of Conduct

This project has adopted the [im-open's Code of Conduct](https://github.com/im-open/.github/blob/master/CODE_OF_CONDUCT.md).

## License

Copyright &copy; 2021, Extend Health, LLC. Code released under the [MIT license](LICENSE).

[git-version-lite]: https://github.com/im-open/git-version-lite
[Actions REST API]: https://docs.github.com/en/rest/reference/actions#list-jobs-for-a-workflow-run