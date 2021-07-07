# workflow-conclusion

This action will examine the outcome for each completed job in a workflow run to output a single outcome for the workflow.

The conclusion is determined by:
 - First looking for any Skipped jobs and if found the conclusion is set to `skipped`
 - Then looking for any Cancelled jobs and if found the conclusion is set to `cancelled`
 - Then looking for any Failed jobs and if found the conclusion is set to `failure`
 - Finally looking for any Successful jobs and if found the conclusion is set to `success`
 - If none of the statuses are found, it will set the conclusion to the fallback value which defaults to `skipped`

## Inputs
| Parameter             | Is Required | Description                                                                         |
| --------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `github-token`        | true        | The token used to make API requests                                                 |
| `fallback-conclusion` | false       | The fallback conclusion to use when one cannot be determined.  Defaults to skipped. |

## Outputs
| Output       | Description              |
| ------------ | ------------------------ |
| `conclusion` | The workflow conclusion. |

## Example

```yml
jobs:
  approve:
    runs-on: [ubuntu-20.04]
    steps:
      run: check-for-approval.sh

  deploy:
    runs-on: [ubuntu-20.04]
    steps:
      run: deploy-the-code.sh

  update-deployment-board:
    runs-on: [ubuntu-20.04]
    needs: [approval, deploy]
    if: always()
    steps:
      - uses: im-open/workflow-conclusion@v1.0.0
        id: conclusion
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Update Deployment Board
        uses: im-open/update-deployment-board@v1.0.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN}}
          environment: ${{ github.event.inputs.environment }}
          board-number: 1
          ref: ${{ github.event.inputs.branch-tag-sha }}
          deploy-status: ${{ env.WORKFLOW_CONCLUSION }} # can also use ${{ steps.conclusion.conclusion }}
```

## Recompiling

If changes are made to the action's code in this repository, or its dependencies, you will need to re-compile the action.

```sh
# Installs dependencies and bundles the code
npm run build

# Bundle the code (if dependencies are already installed)
npm run bundle
```

These commands utilize [esbuild](https://esbuild.github.io/getting-started/#bundling-for-node) to bundle the action and
its dependencies into a single file located in the `dist` folder.

## Code of Conduct

This project has adopted the [im-open's Code of Conduct](https://github.com/im-open/.github/blob/master/CODE_OF_CONDUCT.md).

## License

Copyright &copy; 2021, Extend Health, LLC. Code released under the [MIT license](LICENSE).
