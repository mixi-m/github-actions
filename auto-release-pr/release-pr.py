import github

from typing import Optional
import difflib
import os
import re
import sys


GITHUB_TOKEN: str = os.environ['INPUT_GITHUBTOKEN']
REPO_NAME: str = os.environ['GITHUB_REPOSITORY']
BASE_BRANCH: str = os.environ['INPUT_BASEBRANCH']
HEAD_BRANCH: str = os.environ['INPUT_HEADBRANCH']
RELEASE_PR_NUMBER: Optional[str] = os.environ.get('INPUT_RELEASEPRNUMBER')

BODY_TEMPLATE: str = os.environ['INPUT_BODYTEMPLATE']
COMMENT_TEMPLATE: str = os.environ['INPUT_COMMENTTEMPLATE']
RELEASE_PR_LABEL: Optional[str] = os.environ.get('INPUT_RELEASEPRLABEL')

NEW_RELEASE_PR_TITLE: str = os.environ['INPUT_NEWRELEASEPRTITLE']
CHECK_TEXT: str = os.environ['INPUT_CHECK_TEXT']
CHECKBOX_STR: str = "  - [ ] #{CHECK_TEXT}"

# release 向きの最新 PR を取得
def find_latest_release_pr(repo: github.Repository.Repository, base: str, head: str) -> Optional[github.PullRequest.PullRequest]:	
    prs = repo.get_pulls(state='open', base=base, head=head, sort='created', direction='desc')	

    if prs.totalCount > 0:	
        return prs[0]	
    else:	
        return None

# release 向きの最新 PR を取得を探して、なかったら作成する
def find_or_create_release_pr(repo: github.Repository.Repository, base: str, head: str, number: Optional[str], new_title: str) -> github.PullRequest.PullRequest:	
    if number:
        return repo.get_pull(int(number))

    latest = find_latest_release_pr(repo, base=base, head=head)
    if latest:
        return latest
    else:
        return repo.create_pull(title=new_title,
                                body='',
                                base=base,
                                head=head,
                                draft=True)

# PR にラベル付与
def add_label(pr: github.PullRequest.PullRequest, label: Optional[str]):
    if not label:
        return
    
    pr.add_to_labels(label)

# PR のコミットメッセージから含まれる PR を探して新しいの PR の body を作る
def make_new_body(repo: github.Repository.Repository, pr: github.PullRequest.PullRequest, template: str) -> Optional[str]:
    commit_messages = [cm.commit.message for cm in pr.get_commits()]
    merge_commit_messages = [m for m in commit_messages if m.startswith("Merge pull request")]
    current_checklist = filter(lambda line: CHECK_TEXT in line, (pr.body or "").splitlines())
        
    # 複数行のコミットメッセージから箇条書きの一行を生成する
    def convert_to_body_line(index: int, message: str) -> str:
        lines = message.splitlines()
        number = re.search(r'#(\d+)', lines[0]).group(1)
        title = repo.get_pull(int(number)).title
        try:
            checkbox = current_checklist[index]
        except IndexError:
            checkbox = CHECKBOX_STR

        return f"- #{number}: {title}\n#{checkbox}"
    
    body = '\n'.join(map(convert_to_body_line, enumerate(merge_commit_messages)))
    if len(body) > 0:
        return template.format(summary=body)
    else:
        return None

def main():
    g = github.Github(GITHUB_TOKEN)
    repo = g.get_repo(REPO_NAME)
    release_pr = find_or_create_release_pr(repo, base=BASE_BRANCH, head=HEAD_BRANCH, number=RELEASE_PR_NUMBER, new_title=NEW_RELEASE_PR_TITLE)

    add_label(release_pr, label=RELEASE_PR_LABEL)

    # body を生成
    new_body = make_new_body(repo, release_pr, template=BODY_TEMPLATE)
    if not new_body:
        print("Failed to generate new PR body.")
        sys.exit(1)

    # diff を生成
    old_body_lines = (release_pr.body or "" ).splitlines()
    new_body_lines = new_body.splitlines() 
    diff = '\n'.join(difflib.unified_diff(old_body_lines, new_body_lines))

    # PR 本文を更新
    release_pr.edit(body=new_body)

    # comment に diff を残す
    comment_body = COMMENT_TEMPLATE.format(diff=diff)
    release_pr.as_issue().create_comment(comment_body)


if __name__ == "__main__":
    main()
