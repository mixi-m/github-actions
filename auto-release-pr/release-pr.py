import github

from typing import Optional
import difflib
import os
import re
import sys


GITHUB_TOKEN = os.environ['INPUT_GITHUBTOKEN']
REPO_NAME = os.environ['GITHUB_REPOSITORY']

COMMENT_TEMPLATE = '''PR body is updated!
<details><summary>diff</summary>
<p>

```diff
{diff}
```

</p>
</detail>
'''


# release 向きの最新 PR を取得
def find_latest_release_pr(repo: github.Repository.Repository) -> Optional[github.PullRequest.PullRequest]:	
    prs = repo.get_pulls(state='open', base='release', head='master', sort='created', direction='desc')	

    if prs.totalCount > 0:	
        return prs[0]	
    else:	
        return None

# release 向きの最新 PR を取得を探して、なかったら作成する
def find_or_create_release_pr(repo: github.Repository.Repository) -> github.PullRequest.PullRequest:	
    latest = find_latest_release_pr(repo)
    if latest:
        return latest
    else:
        return repo.create_pull(title='[リリース]',
                                body='',
                                base='release',
                                head='master',
                                draft=True)

# PR のコミットメッセージから含まれる PR を探して新しいの PR の body を作る
def make_new_body(pr: github.PullRequest.PullRequest) -> Optional[str]:
    commit_messages = [cm.commit.message for cm in pr.get_commits()]
    merge_commit_messages = [m for m in commit_messages if m.startswith("Merge pull request")]

    # 複数行のコミットメッセージから箇条書きの一行を生成する
    def convert_to_body_line(message: str) -> str:
        lines = message.splitlines()

        number = re.search(r'#\d+', lines[0]).group()
        title = lines[2]

        return f'- {number}: {title}'

    body_lines = '\n'.join(map(convert_to_body_line, merge_commit_messages))
    if len(body_lines) > 0:
        return '## Changes\n\n' + body_lines
    else:
        return None

def main():
    g = github.Github(GITHUB_TOKEN)
    repo = g.get_repo(REPO_NAME)
    release_pr = find_or_create_release_pr(repo)

    # body を生成
    new_body = make_new_body(release_pr)
    if not new_body:
        print("Failed to generate new PR body.")
        sys.exit(1)

    # diff を生成
    old_body_lines = release_pr.body.splitlines()
    new_body_lines = new_body.splitlines() 
    diff = '\n'.join(difflib.unified_diff(old_body_lines, new_body_lines))

    # PR 本文を更新
    release_pr.edit(body=new_body)

    # comment に diff を残す
    comment_body = COMMENT_TEMPLATE.format(diff=diff)
    release_pr.as_issue().create_comment(comment_body)


if __name__ == "__main__":
    main()
