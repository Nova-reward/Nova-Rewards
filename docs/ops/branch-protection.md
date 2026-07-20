# Branch Protection Rules

Configure these rules on the `main` branch in **GitHub → Settings → Branches → Add rule**.

## Required Settings

**Branch name pattern:** `main`

| Setting | Value |
|---|---|
| Require a pull request before merging | ✅ |
| Require status checks to pass before merging | ✅ |
| Require branches to be up to date before merging | ✅ |
| Do not allow bypassing the above settings | ✅ |

## Required Status Checks

Add each of the following check names (must match the `name:` field in the workflow jobs exactly):

- `Secret Scan`
- `Lint (Backend)`
- `Lint (Frontend)`
- `Type Check (Frontend)`
- `Test (Backend)`
- `Test (Contracts)`
- `Build (Frontend)`
- `Build (Contracts)`

## Steps

1. Go to **Settings → Branches** in the GitHub repository.
2. Click **Add branch protection rule**.
3. Set **Branch name pattern** to `main`.
4. Enable **Require a pull request before merging**.
5. Enable **Require status checks to pass before merging**.
6. Search for and add each check listed above.
7. Enable **Require branches to be up to date before merging**.
8. Enable **Do not allow bypassing the above settings** to prevent admins from skipping checks.
9. Click **Save changes**.

## Notes

- Status check names only appear in the search box after the CI workflow has run at least once on the repository.
- If a check is not found, push a branch and open a PR to trigger the first run, then return to add the checks.
